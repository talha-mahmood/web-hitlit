/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        app: "var(--jazba-app)",
        surface: "var(--jazba-surface)",
        "surface-raised": "var(--jazba-surface-raised)",
        // Keep legacy white card utility calls aligned with the shared
        // surface token while white foreground text uses jazba-white.
        white: "var(--jazba-white)",
        "jazba-white": "#F5F7FA",
        gray: {
          50: "var(--jazba-gray-50)",
          100: "var(--jazba-gray-100)",
          200: "var(--jazba-gray-200)",
          300: "var(--jazba-gray-300)",
          400: "var(--jazba-gray-400)",
          500: "var(--jazba-gray-500)",
          600: "var(--jazba-gray-600)",
          700: "var(--jazba-gray-700)",
          800: "var(--jazba-gray-800)",
          900: "var(--jazba-gray-900)",
        },
        green: {
          50: "var(--jazba-green-50)", 100: "var(--jazba-green-100)", 200: "var(--jazba-green-200)",
          300: "var(--jazba-green-300)", 400: "var(--jazba-green-400)", 500: "var(--jazba-green-500)",
          600: "var(--jazba-green-600)", 700: "var(--jazba-green-700)", 800: "var(--jazba-green-800)", 900: "var(--jazba-green-900)",
        },
        red: {
          50: "var(--jazba-red-50)", 100: "var(--jazba-red-100)", 200: "var(--jazba-red-200)", 300: "var(--jazba-red-300)",
          400: "var(--jazba-red-400)", 500: "var(--jazba-red-500)", 600: "var(--jazba-red-600)", 700: "var(--jazba-red-700)",
          800: "var(--jazba-red-800)", 900: "var(--jazba-red-900)",
        },
        blue: {
          50: "var(--jazba-blue-50)", 100: "var(--jazba-blue-100)", 200: "var(--jazba-blue-200)", 300: "var(--jazba-blue-300)",
          400: "var(--jazba-blue-400)", 500: "var(--jazba-blue-500)", 600: "var(--jazba-blue-600)", 700: "var(--jazba-blue-700)",
          800: "var(--jazba-blue-800)", 900: "var(--jazba-blue-900)",
        },
        orange: {
          50: "var(--jazba-orange-50)", 100: "var(--jazba-orange-100)", 200: "var(--jazba-orange-200)", 300: "var(--jazba-orange-300)",
          400: "var(--jazba-orange-400)", 500: "var(--jazba-orange-500)", 600: "var(--jazba-orange-600)", 700: "var(--jazba-orange-700)",
          800: "var(--jazba-orange-800)", 900: "var(--jazba-orange-900)",
        },
        amber: {
          50: "var(--jazba-amber-50)", 100: "var(--jazba-amber-100)", 200: "var(--jazba-amber-200)", 300: "var(--jazba-amber-300)",
          400: "var(--jazba-amber-400)", 500: "var(--jazba-amber-500)", 600: "var(--jazba-amber-600)", 700: "var(--jazba-amber-700)",
          800: "var(--jazba-amber-800)", 900: "var(--jazba-amber-900)",
        },
        purple: {
          50: "var(--jazba-purple-50)", 100: "var(--jazba-purple-100)", 200: "var(--jazba-purple-200)", 300: "var(--jazba-purple-300)",
          400: "var(--jazba-purple-400)", 500: "var(--jazba-purple-500)", 600: "var(--jazba-purple-600)", 700: "var(--jazba-purple-700)",
          800: "var(--jazba-purple-800)", 900: "var(--jazba-purple-900)",
        },
        primary: {
          DEFAULT: "var(--jazba-primary)",
          dark: "var(--jazba-primary-dark)",
          light: "var(--jazba-primary-light)",
        },
        ink: "var(--jazba-ink)",
        muted: "var(--jazba-muted)",
        border: "var(--jazba-border)",
        danger: "#EF4444",
        warning: "#F59E0B",
      },
    },
  },
  plugins: [],
};
