import { Image } from "react-native";

// Custom Profile tab icon (assets/profileSection_icon.png) in place of a
// generic person glyph. Always shown at full opacity — the icon's own dark
// green is the intended color, and the existing dot indicator above the tab
// bar icon already carries the focused/unfocused signal on its own.
export default function ProfileTabIcon({ size }: { focused: boolean; size: number }) {
  // Vector tab icons (e.g. Venues' "location" glyph) have built-in visual
  // padding baked into their glyph, inked well short of their nominal
  // bounding box's bottom edge — this PNG fills its box edge-to-edge, so
  // without extra space below it the label sits closer to it than it does
  // under the other tab icons. Keep the icon itself at full `size` and add
  // that gap as its own margin instead of shrinking the icon to fake it.
  return (
    <Image
      source={require("../../assets/profileSection_icon.png")}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", marginBottom: 4 }}
      resizeMode="cover"
    />
  );
}
