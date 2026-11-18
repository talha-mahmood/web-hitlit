import { colors } from "@app/constants/theme";
import { useThemeStore } from "@app/store/themeStore";
import { Ionicon } from "./icons/Icon";

// The Home header's light/dark switch (top-left in the app): a pill track
// with a sun or moon and a white knob that slides to the other side.
export default function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  // Same rule as the app: "system" counts as light only while the light
  // palette is the active one.
  const isLight = preference === "light" || (preference === "system" && colors.background === "#F5F7FA");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle light and dark theme"
      title={isLight ? "Switch to dark theme" : "Switch to light theme"}
      onClick={() => setPreference(isLight ? "dark" : "light")}
      className="relative flex h-9 w-[68px] shrink-0 items-center rounded-full border px-[3px]"
      style={{
        backgroundColor: isLight ? "#E6E7E8" : "#34383D",
        borderColor: isLight ? "#D4D7DA" : "#555B61",
        boxShadow: `0 2px 3px rgba(0,0,0,${isLight ? 0.14 : 0.24})`,
        justifyContent: isLight ? "flex-end" : "flex-start",
      }}
    >
      <Ionicon name={isLight ? "sunny" : "moon"} size={16} color="#F5B93B" style={{ position: "absolute", left: isLight ? 10 : 41 }} />
      <span
        className="h-7 w-7 rounded-full border bg-white transition-all"
        style={{ borderColor: isLight ? "#F4F4F4" : "#D5D7D9", boxShadow: "0 1px 2px rgba(0,0,0,0.16)" }}
      />
    </button>
  );
}
