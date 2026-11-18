import { colors } from "../constants/theme";
import type { ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

// NativeWind only auto-resolves `className` on its own pre-registered core
// components — a third-party component like expo's LinearGradient needs to
// opt in explicitly, otherwise `className` would silently do nothing here.
cssInterop(LinearGradient, { className: "style" });

// The one brand green gradient used everywhere a solid green fill used to
// be. Read stops at render time so the same shared component follows the
// selected theme while preserving the original dark palette.

type Props = Omit<ComponentProps<typeof LinearGradient>, "colors"> & { className?: string };

// Drop-in replacement for a `<View className="bg-primary ...">` (or any
// other flat brand-green fill) — pass the same layout/rounding/padding
// classes via `className`, minus the `bg-primary*` class, and this paints
// the brand gradient as the background instead of a flat color.
export default function GradientFill({ start = { x: 0, y: 0 }, end = { x: 1, y: 1 }, ...rest }: Props) {
  return <LinearGradient colors={[colors.primaryDeep, colors.primaryDark, colors.primary]} start={start} end={end} {...rest} />;
}
