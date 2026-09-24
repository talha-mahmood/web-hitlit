import { Image } from "react-native";

// Custom Profile tab icon (assets/profileSection_icon.png) in place of a
// generic person glyph. Always shown at full opacity — the icon's own dark
// green is the intended color, and the existing dot indicator above the tab
// bar icon already carries the focused/unfocused signal on its own.
export default function ProfileTabIcon({ size }: { focused: boolean; size: number }) {
  return (
    <Image
      source={require("../../assets/profileSection_icon.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
