/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D9254",
          dark: "#0E5C34",
          light: "#DCEFE4",
        },
        ink: "#1A1A1A",
        muted: "#6B7280",
        border: "#E5E7EB",
        danger: "#DC2626",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};
