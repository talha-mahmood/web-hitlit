// Type-only stand-in: shared files reference icon *names* via
// `keyof typeof Ionicons.glyphMap` / `ComponentProps<typeof MaterialCommunityIcons>["name"]`.
// The website renders those names with its own <Ionicon>/<MCIcon> components.
import type { FC } from "react";

type IconProps = { name: string; size?: number; color?: string };
type IconComponent = FC<IconProps> & { glyphMap: Record<string, number> };

const placeholder = (() => null) as unknown as IconComponent;
placeholder.glyphMap = {};

export const Ionicons = placeholder;
export const MaterialCommunityIcons = placeholder;
