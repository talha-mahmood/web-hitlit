/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16A34A",
          dark: "#15803D",
          light: "#DCFCE7",
        },
        ink: "#1A1A1A",
        muted: "#6B7280",
      },
    },
  },
  plugins: [],
};
