/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        app: "#050B12",
        surface: "#0A1723",
        "surface-raised": "#0D1C29",
        // Keep legacy white card utility calls aligned with the shared
        // surface token while white foreground text uses jazba-white.
        white: "#0A1723",
        "jazba-white": "#F5F7FA",
        gray: {
          50: "#0D1C29",
          100: "#142533",
          200: "#1C2D3A",
          300: "#516171",
          400: "#718092",
          500: "#9AA8B7",
          600: "#AEB9C5",
          700: "#CBD4DD",
          800: "#E1E7ED",
          900: "#F5F7FA",
        },
        green: {
          50: "#103A2A",
          100: "#164A34",
          200: "#1C5E3D",
          300: "#21834D",
          400: "#18C66A",
          500: "#18C66A",
          600: "#18C66A",
          700: "#18C66A",
          800: "#0F9F58",
          900: "#0B6C3C",
        },
        red: {
          50: "#351419", 100: "#4B1D25", 200: "#7F2531", 300: "#B23B47",
          400: "#EF4444", 500: "#EF4444", 600: "#DC2626", 700: "#C81E2B",
          800: "#A61B27", 900: "#7F1D1D",
        },
        blue: {
          50: "#102638", 100: "#17384F", 200: "#205472", 300: "#26749A",
          400: "#38BDF8", 500: "#0EA5E9", 600: "#0284C7", 700: "#38BDF8",
          800: "#0369A1", 900: "#0C4A6E",
        },
        orange: {
          50: "#382516", 100: "#4A301B", 200: "#704522", 300: "#A75F24",
          400: "#FB923C", 500: "#F97316", 600: "#FB923C", 700: "#F97316",
          800: "#C2410C", 900: "#7C2D12",
        },
        amber: {
          50: "#352A13", 100: "#493715", 200: "#6C5018", 300: "#A87818",
          400: "#FBBF24", 500: "#F59E0B", 600: "#FBBF24", 700: "#F59E0B",
          800: "#B45309", 900: "#78350F",
        },
        purple: {
          50: "#271C3B", 100: "#35264E", 200: "#4F3675", 300: "#7450A8",
          400: "#C084FC", 500: "#A855F7", 600: "#C084FC", 700: "#A855F7",
          800: "#7E22CE", 900: "#581C87",
        },
        primary: {
          DEFAULT: "#18C66A",
          dark: "#0F9F58",
          light: "#103A2A",
        },
        ink: "#F5F7FA",
        muted: "#9AA8B7",
        border: "#1C2D3A",
        danger: "#EF4444",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};
