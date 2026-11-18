// Side-effect module: replaces React Native's built-in `ActivityIndicator`
// export with our custom hourglass spinner, so every existing
// `<ActivityIndicator ... />` in the app (200+ usages across ~80 files)
// renders the new spinner automatically — no call site needs to change.
//
// Every file's `import { ActivityIndicator } from "react-native"` compiles
// down to a live property read on the SAME shared module object at each
// usage (not a one-time local copy), so reassigning that property here is
// visible everywhere else too — same mechanism as alertPolyfill.ts. Unlike
// `Alert` (an object we mutate a method on), the whole `ActivityIndicator`
// export IS the component. react-native's index.js exports it as a
// getter-only property (`get ActivityIndicator() { ... }`, no setter), so a
// plain `RN.ActivityIndicator = ...` throws ("which has only a getter") —
// Object.defineProperty replaces the accessor with a plain writable value
// instead. Must be imported once, as early as possible (top of App.tsx).
import HourglassActivityIndicator from "../components/HourglassActivityIndicator";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RN = require("react-native");
Object.defineProperty(RN, "ActivityIndicator", {
  value: HourglassActivityIndicator,
  writable: true,
  configurable: true,
  enumerable: true,
});
