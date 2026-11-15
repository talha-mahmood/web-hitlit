// Keeps tsconfig.json's `paths` in step with src/platform/overrides/: every
// override gets an exact "@app/<path>" mapping, so website code importing
// "@app/lib/supabase" is type-checked against the web version that Vite
// actually bundles (vite.config.ts's appBridge does the runtime swap).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES = path.join(WEB, "src/platform/overrides");
const TSCONFIG = path.join(WEB, "tsconfig.json");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const toPosix = (p) => p.split(path.sep).join("/");

const paths = { "@app/*": ["./shared/src/*"], "@assets/*": ["./shared/assets/*"], "@/*": ["./src/*"] };
for (const file of walk(OVERRIDES).filter((f) => /\.tsx?$/.test(f)).sort()) {
  const rel = toPosix(path.relative(OVERRIDES, file)).replace(/\.tsx?$/, "");
  paths[`@app/${rel}`] = [`./${toPosix(path.relative(WEB, file))}`];
}
Object.assign(paths, {
  "react-native": ["./src/platform/shims/react-native.ts"],
  "@react-native-async-storage/async-storage": ["./src/platform/shims/async-storage.ts"],
  "@expo/vector-icons": ["./src/platform/shims/vector-icons.ts"],
  // Types first: a package without bundled types (react) must resolve to
  // @types/* before its plain JS entry.
  "*": ["./node_modules/@types/*", "./node_modules/*"],
});

const config = JSON.parse(fs.readFileSync(TSCONFIG, "utf8"));
config.compilerOptions.paths = paths;
fs.writeFileSync(TSCONFIG, JSON.stringify(config, null, 2) + "\n");
console.log(`tsconfig paths: ${Object.keys(paths).length - 7} override mappings`);
