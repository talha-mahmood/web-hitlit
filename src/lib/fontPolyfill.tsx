// Side-effect module: replaces React Native's `Text` and `TextInput` exports
// with thin wrappers that render everything in Poppins — same mechanism as
// alertPolyfill.ts / activityIndicatorPolyfill.ts, so none of the ~hundreds
// of existing <Text className="font-bold ..."> call sites need to change.
//
// Why a wrapper instead of just a Tailwind fontFamily: on Android (and iOS
// too for non-system fonts) a custom font is a separate *file per weight* —
// `fontWeight: "700"` alone doesn't pick a bold Poppins, it asks the OS to
// fake-bold whatever family it's given. So the weight the app already asks
// for (via `font-bold`/`font-semibold`/... classes or an inline
// `fontWeight`) is translated here into the matching Poppins file, and the
// raw fontWeight is neutralised so nothing gets double-bolded.
//
//   default / 100–400 / font-normal  → Poppins-Regular
//   500 / font-medium                → Poppins-Medium
//   600 / font-semibold              → Poppins-SemiBold
//   700+ / font-bold / -extrabold    → Poppins-Bold
//
// Must be imported once, before anything renders (top of App.tsx). The font
// files themselves are loaded by useFonts in App.tsx (see POPPINS_FONTS).
import { createContext, forwardRef, useContext } from "react";
import { StyleSheet, type TextInputProps, type TextProps } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RN = require("react-native");

export const POPPINS_FONTS = {
  "Poppins-Regular": require("@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf"),
  "Poppins-Medium": require("@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf"),
  "Poppins-SemiBold": require("@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf"),
  "Poppins-Bold": require("@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf"),
};

type PoppinsFamily = keyof typeof POPPINS_FONTS;

const NAMED_WEIGHT_TO_FAMILY: Record<string, PoppinsFamily> = {
  thin: "Poppins-Regular",
  extralight: "Poppins-Regular",
  light: "Poppins-Regular",
  normal: "Poppins-Regular",
  medium: "Poppins-Medium",
  semibold: "Poppins-SemiBold",
  bold: "Poppins-Bold",
  extrabold: "Poppins-Bold",
  black: "Poppins-Bold",
};

function familyForNumericWeight(weight: number): PoppinsFamily {
  if (weight >= 700) return "Poppins-Bold";
  if (weight >= 600) return "Poppins-SemiBold";
  if (weight >= 500) return "Poppins-Medium";
  return "Poppins-Regular";
}

// An explicit weight from an inline style ("bold", "700", 700, "normal"…).
function familyFromStyleWeight(weight: unknown): PoppinsFamily | undefined {
  if (weight === undefined || weight === null) return undefined;
  if (typeof weight === "number") return familyForNumericWeight(weight);
  const w = String(weight);
  if (w === "bold") return "Poppins-Bold";
  if (w === "normal") return "Poppins-Regular";
  const n = Number(w);
  return Number.isFinite(n) ? familyForNumericWeight(n) : undefined;
}

// An explicit weight from NativeWind classes — the last font-* token wins
// (variant prefixes like "dark:" are tolerated).
function familyFromClassName(className: string | undefined): PoppinsFamily | undefined {
  if (!className) return undefined;
  let found: PoppinsFamily | undefined;
  for (const token of className.split(/\s+/)) {
    const match = /(?:^|:)font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.exec(token);
    if (match) found = NAMED_WEIGHT_TO_FAMILY[match[1]];
  }
  return found;
}

// A Text nested inside another Text inherits the parent's font natively —
// so with no weight of its own it must be left alone (forcing Regular here
// would un-bold e.g. a plain span inside a bold heading).
const NestedTextContext = createContext(false);

function resolveStyle(
  style: TextProps["style"],
  className: string | undefined,
  nested: boolean
): { override: { fontFamily: PoppinsFamily; fontWeight: "normal" } | null } {
  const flat = StyleSheet.flatten(style) as { fontFamily?: string; fontWeight?: unknown } | undefined;
  // Someone (a third-party component, or a deliberate one-off) already chose
  // a specific font — respect it.
  if (flat?.fontFamily) return { override: null };

  const explicit = familyFromStyleWeight(flat?.fontWeight) ?? familyFromClassName(className);
  if (!explicit && nested) return { override: null };
  return { override: { fontFamily: explicit ?? "Poppins-Regular", fontWeight: "normal" } };
}

const RNText = RN.Text;
const RNTextInput = RN.TextInput;

const PoppinsText = forwardRef<unknown, TextProps & { className?: string }>(function PoppinsText(props, ref) {
  const nested = useContext(NestedTextContext);
  const { override } = resolveStyle(props.style, props.className, nested);
  return (
    <NestedTextContext.Provider value>
      {/* Every screen's card/list layouts are built to tight, hand-tuned
          fixed dimensions — left scaling with the device's own
          accessibility font-size setting (RN's default), a few extra
          points on every row of text in a card compounds into real extra
          height, which is why the same screen could show a different
          number of cards depending on the phone/user's font-size setting,
          not just its actual screen size. Pass allowFontScaling explicitly
          on any one Text that should still respect it — {...props} is
          spread after this default specifically so that override wins. */}
      <RNText allowFontScaling={false} {...props} ref={ref} style={override ? [props.style, override] : props.style} />
    </NestedTextContext.Provider>
  );
});

const PoppinsTextInput = forwardRef<unknown, TextInputProps & { className?: string }>(function PoppinsTextInput(props, ref) {
  const { override } = resolveStyle(props.style, props.className, false);
  return <RNTextInput allowFontScaling={false} {...props} ref={ref} style={override ? [props.style, override] : props.style} />;
});

for (const [name, component] of [
  ["Text", PoppinsText],
  ["TextInput", PoppinsTextInput],
] as const) {
  // react-native's index exports these as getter-only properties, so a plain
  // assignment throws — defineProperty swaps in a writable value instead.
  Object.defineProperty(RN, name, { value: component, writable: true, configurable: true, enumerable: true });
}
