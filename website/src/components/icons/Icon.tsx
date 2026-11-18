import type { CSSProperties } from "react";
import { ION, MDI } from "./registry.generated";

type Props = {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

// <Ionicons name="…"> from the app, same glyph names.
export function Ionicon({ name, size = 24, color = "currentColor", className, style, title }: Props) {
  const Glyph = ION[name];
  if (!Glyph) {
    if (import.meta.env.DEV) console.warn(`[Ionicon] unknown glyph "${name}" — run npm run icons`);
    return <span style={{ display: "inline-block", width: size, height: size }} />;
  }
  return (
    <Glyph
      size={size}
      color={color}
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}

// <MaterialCommunityIcons name="…"> from the app, same glyph names.
export function MCIcon({ name, size = 24, color = "currentColor", className, style, title }: Props) {
  const d = MDI[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0, ...style }}
      fill={color}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {d ? <path d={d} /> : null}
    </svg>
  );
}
