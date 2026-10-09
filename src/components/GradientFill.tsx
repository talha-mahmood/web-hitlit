import type { ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

// NativeWind only auto-resolves `className` on its own pre-registered core
// components — a third-party component like expo's LinearGradient needs to
// opt in explicitly, otherwise `className` would silently do nothing here.
cssInterop(LinearGradient, { className: "style" });

// The one brand green gradient used everywhere a solid green fill used to
// be (buttons, hero banners, badges, icon tints, …) — same three stops as
// the Game Detail screen's hero header, so every green surface in the app
// now reads as the same gradient instead of several flat shades of green.
export const BRAND_GREEN_GRADIENT = ["#07301D", "#0E5C34", "#1D9254"] as const;

type Props = Omit<ComponentProps<typeof LinearGradient>, "colors"> & { className?: string };

// Drop-in replacement for a `<View className="bg-primary ...">` (or any
// other flat brand-green fill) — pass the same layout/rounding/padding
// classes via `className`, minus the `bg-primary*` class, and this paints
// the brand gradient as the background instead of a flat color.
export default function GradientFill({ start = { x: 0, y: 0 }, end = { x: 1, y: 1 }, ...rest }: Props) {
  return <LinearGradient colors={BRAND_GREEN_GRADIENT} start={start} end={end} {...rest} />;
}
