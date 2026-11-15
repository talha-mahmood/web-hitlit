import { defineConfig, loadEnv, normalizePath, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// The website shares the mobile app's business logic (../src/lib, hooks,
// store, types, constants) instead of copying it — same Supabase queries,
// same scoring engines, same validation. Two things make that work:
//
// 1. Platform overrides. A handful of app files talk to native-only APIs
//    (AsyncStorage-backed Supabase auth, Google/Apple native sign-in, expo
//    image picker, share sheets, GPS…). For each of those, a web version
//    lives at the same relative path under src/platform/overrides/, and any
//    import that resolves to the app's file — from the app's own code or
//    from the website's — is redirected to the override instead. Same idea
//    as React Native's `.web.ts` files, without touching the app's folder.
//
// 2. Single dependency tree. A bare import ("react", "@tanstack/react-query")
//    from a file inside the app's src/ is always resolved from the website's
//    own node_modules, so there's exactly one React / one QueryClient context
//    even if the app's own node_modules happens to be installed too.
const WEB_ROOT = __dirname;
const APP_SRC = path.resolve(WEB_ROOT, "../src");
const OVERRIDES = path.resolve(WEB_ROOT, "src/platform/overrides");
const SHIMS = path.resolve(WEB_ROOT, "src/platform/shims");
const RESOLVE_FROM = path.resolve(WEB_ROOT, "src/main.tsx");

// Native modules that shared files still import (type-only or tiny runtime
// pieces) — mapped to small web shims.
const NATIVE_SHIMS: Record<string, string> = {
  "react-native": "react-native.ts",
  "@react-native-async-storage/async-storage": "async-storage.ts",
  "@expo/vector-icons": "vector-icons.ts",
};

const EXTENSIONS = [".ts", ".tsx"];

// Returned ids are normalized (forward slashes): an override that's also
// reached through a plain relative import (e.g. upload.ts → "./supabase")
// must resolve to the exact same module id, or it would be instantiated
// twice — two Supabase clients with diverging auth state.
function findOverride(appFile: string): string | null {
  const rel = path.relative(APP_SRC, appFile);
  if (rel.startsWith("..")) return null;
  const base = path.join(OVERRIDES, rel.replace(/\.(tsx?|jsx?)$/, ""));
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(base + ext)) return normalizePath(base + ext);
  }
  return null;
}

function isInside(file: string | undefined, dir: string): boolean {
  if (!file) return false;
  const rel = path.relative(dir, file.split("?")[0]);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

function appBridge(): Plugin {
  return {
    name: "hitlit-app-bridge",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source.startsWith("\0")) return null;

      const shim = NATIVE_SHIMS[source];
      if (shim) return normalizePath(path.join(SHIMS, shim));

      const isBare = !source.startsWith(".") && !path.isAbsolute(source) && !source.startsWith("@app/");
      const effectiveImporter = isBare && isInside(importer, APP_SRC) ? RESOLVE_FROM : importer;

      const resolved = await this.resolve(source, effectiveImporter, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return resolved;

      const override = isInside(resolved.id, APP_SRC) ? findOverride(resolved.id) : null;
      return override ? { ...resolved, id: override } : resolved;
    },
  };
}

// Site-level output: absolute URLs in index.html's share tags, robots.txt,
// sitemap.xml (the only public pages are sign-in and the privacy policy;
// everything else needs an account) and the service worker, which is
// templated with this build's JS/CSS chunk list so a new deploy replaces
// the old offline cache.
function siteFiles(siteUrl: string, supabaseUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, "");
  return {
    name: "hitlit-site",
    transformIndexHtml(html) {
      return html.replaceAll("%SITE_URL%", site).replace(
        "<!--preconnect-->",
        supabaseUrl ? `<link rel="preconnect" href="${new URL(supabaseUrl).origin}" crossorigin />` : ""
      );
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /$\nAllow: /privacy\nDisallow: /\n\nSitemap: ${site}/sitemap.xml\n` });
      const urls = ["/", "/privacy"].map((u) => `  <url><loc>${site}${u}</loc></url>`).join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      const precache = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .sort()
        .map((f) => `/${f}`);
      precache.push("/manifest.webmanifest", "/favicon.png", "/logo.png");
      const build = crypto.createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
      const template = fs.readFileSync(path.resolve(WEB_ROOT, "src/sw/sw.js"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template.replace("__BUILD_ID__", build).replace("__PRECACHE__", JSON.stringify(precache)),
      });
    },
  };
}

// esbuild would otherwise look up the nearest tsconfig for every file — for
// shared files that's the app's own tsconfig.json, which extends
// "expo/tsconfig.base" (only installed on the app side). A string tsconfigRaw
// skips that lookup; these are the only fields esbuild uses anyway.
const ESBUILD_TSCONFIG = JSON.stringify({
  compilerOptions: { target: "ES2022", useDefineForClassFields: true, jsx: "react-jsx" },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, WEB_ROOT, "VITE_");
  return {
    plugins: [appBridge(), react(), siteFiles(env.VITE_SITE_URL || "https://hitlit.pk", env.VITE_SUPABASE_URL ?? "")],
    esbuild: { tsconfigRaw: ESBUILD_TSCONFIG },
    optimizeDeps: { esbuildOptions: { tsconfigRaw: ESBUILD_TSCONFIG } },
    resolve: {
      alias: {
        "@app": APP_SRC,
        "@assets": path.resolve(WEB_ROOT, "../assets"),
        "@": path.resolve(WEB_ROOT, "src"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query", "@supabase/supabase-js", "zustand"],
    },
    // The app's shared files read Expo's EXPO_PUBLIC_* names — fed from the
    // website's own VITE_* env so there's one place to configure.
    define: {
      "process.env.EXPO_PUBLIC_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL ?? ""),
      "process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ""),
    },
    server: {
      port: 5173,
      fs: {
        allow: [WEB_ROOT, APP_SRC, path.resolve(WEB_ROOT, "../assets"), path.resolve(WEB_ROOT, "../PRIVACY_POLICY.md")],
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Libraries change less often than the site: separate chunks stay
          // cached across deploys.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return "vendor-react";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-query";
            return undefined;
          },
        },
      },
    },
  };
});
