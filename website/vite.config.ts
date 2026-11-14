import { defineConfig, loadEnv, normalizePath, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

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
    plugins: [appBridge(), react()],
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
    build: { sourcemap: true, chunkSizeWarningLimit: 1500 },
  };
});
