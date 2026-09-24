import { Image } from "react-native";

// Custom Profile tab icon (assets/profileSection_icon.png) in place of a
// generic person glyph. Always shown at full opacity — the icon's own dark
// green is the intended color, and the existing dot indicator above the tab
// bar icon already carries the focused/unfocused signal on its own.
export default function ProfileTabIcon({ size }: { focused: boolean; size: number }) {
  // Vector tab icons (e.g. Venues' "location" glyph) have built-in visual
  // padding inside their nominal bounding box, so they read smaller than
  // this PNG does at the same `size` — scaling it down leaves the same gap
  // beneath it that the other tab icons have.
  const iconSize = size * 1.0;
  return (
    <Image
      source={require("../../assets/profileSection_icon.png")}
      style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2, overflow: "hidden" }}
      resizeMode="cover"
    />
  );
}
