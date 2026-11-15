// Copies the parts of the mobile app the website uses into website/shared/,
// so the website builds and deploys on its own (nothing outside website/ is
// read at build time).
//
// The app stays the single source of truth: never edit website/shared/ by
// hand. After pulling app changes, run `npm run sync-app` (from website/, with
// the app checked out next to it), then build, test and commit the result.
//
// What gets copied: every app file the website imports via "@app/…" or
// "@assets/…", plus everything those files import in turn (relative imports,
// require() and dynamic import()), the privacy policy, and the web-sized
// images made by optimize-images.mjs (those are written straight into the
// website and committed).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.resolve(WEB, "..");
const APP_SRC = path.join(APP, "src");
const APP_ASSETS = path.join(APP, "assets");
const SHARED = path.join(WEB, "shared");
const OVERRIDES = path.join(WEB, "src/platform/overrides");
const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;
const TRY = ["", ".ts", ".tsx", ".js", ".jsx", ".d.ts", "/index.ts", "/index.tsx", "/index.js"];

if (!fs.existsSync(APP_SRC) || !fs.existsSync(path.join(APP, "app.json"))) {
  console.error("sync-app: the mobile app isn't next to website/ (expected ../src and ../app.json). Run this from a full checkout of the repo.");
  process.exit(1);
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules") return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

function resolveFile(base) {
  for (const ext of TRY) {
    const f = base + ext;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function specifiers(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = new Set();
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g, // import … from "x" / export … from "x" (any line breaks)
    /\bimport\s*["']([^"']+)["']/g, // import "x"
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // import("x")
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // require("x")
  ];
  for (const re of patterns) for (const m of text.matchAll(re)) out.add(m[1].split("?")[0]);
  return [...out];
}

// Seeds: the website's own imports of app code and app assets.
const needed = new Set();
const queue = [];
const add = (file) => {
  if (!file || needed.has(file)) return;
  needed.add(file);
  if (CODE.test(file)) queue.push(file);
};
const missing = [];
for (const file of walk(path.join(WEB, "src")).filter((f) => CODE.test(f))) {
  for (const spec of specifiers(file)) {
    if (spec.startsWith("@app/")) {
      const f = resolveFile(path.join(APP_SRC, spec.slice(5)));
      f ? add(f) : missing.push(`${spec} (from ${path.relative(WEB, file)})`);
    } else if (spec.startsWith("@assets/")) {
      const f = resolveFile(path.join(APP_ASSETS, spec.slice(8)));
      f ? add(f) : missing.push(`${spec} (from ${path.relative(WEB, file)})`);
    }
  }
}
// An app file the website replaces with its own version (vite.config.ts's
// appBridge) is still type-checked when another app file imports it
// relatively, so it's copied, but its images/sounds are never bundled.
const hasOverride = (file) => {
  const rel = path.relative(APP_SRC, file);
  if (rel.startsWith("..")) return false;
  const base = path.join(OVERRIDES, rel.replace(/\.(tsx?|jsx?)$/, ""));
  return [".ts", ".tsx"].some((ext) => fs.existsSync(base + ext));
};

// Follow the app files' own relative imports.
while (queue.length) {
  const file = queue.pop();
  const overridden = hasOverride(file);
  for (const spec of specifiers(file)) {
    if (!spec.startsWith(".")) continue;
    const f = resolveFile(path.resolve(path.dirname(file), spec));
    if (!f) {
      missing.push(`${spec} (from ${path.relative(APP, file)})`);
      continue;
    }
    if (path.relative(APP, f).startsWith("..")) continue;
    if (overridden && !CODE.test(f)) continue;
    add(f);
  }
}
if (missing.length) {
  console.error("sync-app: unresolved imports:\n  " + missing.join("\n  "));
  process.exit(1);
}
const policy = path.join(APP, "PRIVACY_POLICY.md");
needed.add(policy);

// Replace website/shared/ with a fresh copy (files deleted in the app go too).
fs.rmSync(SHARED, { recursive: true, force: true });
let bytes = 0;
for (const file of [...needed].sort()) {
  const to = path.join(SHARED, path.relative(APP, file));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(file, to);
  bytes += fs.statSync(file).size;
}
fs.writeFileSync(
  path.join(SHARED, "README.md"),
  `# Copied from the mobile app. Do not edit.

These files are copied from the app (\`../src\`, \`../assets\`, \`../PRIVACY_POLICY.md\`) by
\`npm run sync-app\`, so the website can build without the rest of the repo. Change them in the
app, then run \`npm run sync-app\` in \`website/\` and commit the result.
`
);
const head = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: APP, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();
fs.writeFileSync(path.join(SHARED, "SYNCED_FROM.txt"), `${head}\n`);
console.log(`sync-app: copied ${needed.size} files (${(bytes / 1024).toFixed(0)} KB) from the app at ${head} into website/shared/`);

// Web-sized images from the app's originals (committed with the website).
execFileSync(process.execPath, [path.join(WEB, "scripts/optimize-images.mjs")], { stdio: "inherit" });
