/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#003518",
          dark: "#002510",
          light: "#E3F0E8",
        },
        lime: {
          DEFAULT: "#8FEA24",
          soft: "#B5F75A",
        },
        ink: "#102017",
        muted: "#6E8F7A",
        border: "#E5ECE7",
        offwhite: "#F5F7F3",
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
