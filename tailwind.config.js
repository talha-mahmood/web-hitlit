/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0E7C4A",
          dark: "#0A5C37",
          light: "#E8F5EE",
        },
        ink: "#12181A",
        muted: "#6B7280",
        border: "#E9ECEA",
        offwhite: "#F7F8F6",
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
