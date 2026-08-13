/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16C46A",
          dark: "#0EA25A",
          light: "#DFF9EA",
        },
        amber: { DEFAULT: "#F5A623", light: "#FEF1DA" },
        sky: { DEFAULT: "#3B9EFF", light: "#E1F0FF" },
        coral: { DEFAULT: "#FF5D73", light: "#FFE4E8" },
        violet: { DEFAULT: "#8B5CF6", light: "#EFE7FE" },
        ink: "#1A1A1A",
        muted: "#6B7280",
        border: "#E5E7EB",
        danger: "#DC2626",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["PlusJakartaSans_400Regular"],
        medium: ["PlusJakartaSans_500Medium"],
        semibold: ["PlusJakartaSans_600SemiBold"],
        bold: ["PlusJakartaSans_700Bold"],
        extrabold: ["PlusJakartaSans_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
