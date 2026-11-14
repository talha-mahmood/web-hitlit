/** @type {import('tailwindcss').Config} */
// Same tokens as the mobile app's tailwind.config.js / src/constants/theme.ts.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Theme tokens are CSS variables (src/theme.css) that switch with the
      // light/dark theme, like the app's NativeWind vars. `white` stays a
      // literal white (text on green); card backgrounds use `surface`.
      colors: {
        primary: { DEFAULT: "rgb(var(--jz-primary) / <alpha-value>)", dark: "rgb(var(--jz-primary-dark) / <alpha-value>)", deep: "rgb(var(--jz-primary-deep) / <alpha-value>)", light: "rgb(var(--jz-primary-light) / <alpha-value>)" },
        banner: "#14532D",
        ink: { DEFAULT: "rgb(var(--jz-ink) / <alpha-value>)", secondary: "rgb(var(--jz-ink-secondary) / <alpha-value>)" },
        muted: "rgb(var(--jz-muted) / <alpha-value>)",
        border: "rgb(var(--jz-border) / <alpha-value>)",
        app: "rgb(var(--jz-app) / <alpha-value>)",
        surface: { DEFAULT: "rgb(var(--jz-surface) / <alpha-value>)", raised: "rgb(var(--jz-surface-raised) / <alpha-value>)", overlay: "rgb(var(--jz-surface-overlay) / <alpha-value>)", selection: "rgb(var(--jz-surface-selection) / <alpha-value>)" },
        "image-canvas": "rgb(var(--jz-image-canvas) / <alpha-value>)",
        "jazba-white": "#F5F7FA",
        danger: { DEFAULT: "#EF4444", light: "rgb(var(--jz-danger-light) / <alpha-value>)" },
        warning: { DEFAULT: "#F59E0B", light: "rgb(var(--jz-warning-light) / <alpha-value>)" },
        "info-light": "rgb(var(--jz-info-light) / <alpha-value>)",
        "purple-light": "rgb(var(--jz-purple-light) / <alpha-value>)",
        gray: { 50: "rgb(var(--jz-gray-50) / <alpha-value>)", 100: "rgb(var(--jz-gray-100) / <alpha-value>)", 200: "rgb(var(--jz-gray-200) / <alpha-value>)", 300: "rgb(var(--jz-gray-300) / <alpha-value>)", 400: "rgb(var(--jz-gray-400) / <alpha-value>)", 500: "rgb(var(--jz-gray-500) / <alpha-value>)", 600: "rgb(var(--jz-gray-600) / <alpha-value>)", 700: "rgb(var(--jz-gray-700) / <alpha-value>)", 800: "rgb(var(--jz-gray-800) / <alpha-value>)", 900: "rgb(var(--jz-gray-900) / <alpha-value>)" },
        green: { 50: "rgb(var(--jz-green-50) / <alpha-value>)", 100: "rgb(var(--jz-green-100) / <alpha-value>)", 200: "rgb(var(--jz-green-200) / <alpha-value>)", 300: "rgb(var(--jz-green-300) / <alpha-value>)", 400: "rgb(var(--jz-green-400) / <alpha-value>)", 500: "rgb(var(--jz-green-500) / <alpha-value>)", 600: "rgb(var(--jz-green-600) / <alpha-value>)", 700: "rgb(var(--jz-green-700) / <alpha-value>)", 800: "rgb(var(--jz-green-800) / <alpha-value>)", 900: "rgb(var(--jz-green-900) / <alpha-value>)" },
        red: { 50: "rgb(var(--jz-red-50) / <alpha-value>)", 100: "rgb(var(--jz-red-100) / <alpha-value>)", 200: "rgb(var(--jz-red-200) / <alpha-value>)", 300: "rgb(var(--jz-red-300) / <alpha-value>)", 400: "rgb(var(--jz-red-400) / <alpha-value>)", 500: "rgb(var(--jz-red-500) / <alpha-value>)", 600: "rgb(var(--jz-red-600) / <alpha-value>)", 700: "rgb(var(--jz-red-700) / <alpha-value>)", 800: "rgb(var(--jz-red-800) / <alpha-value>)", 900: "rgb(var(--jz-red-900) / <alpha-value>)" },
        blue: { 50: "rgb(var(--jz-blue-50) / <alpha-value>)", 100: "rgb(var(--jz-blue-100) / <alpha-value>)", 200: "rgb(var(--jz-blue-200) / <alpha-value>)", 300: "rgb(var(--jz-blue-300) / <alpha-value>)", 400: "rgb(var(--jz-blue-400) / <alpha-value>)", 500: "rgb(var(--jz-blue-500) / <alpha-value>)", 600: "rgb(var(--jz-blue-600) / <alpha-value>)", 700: "rgb(var(--jz-blue-700) / <alpha-value>)", 800: "rgb(var(--jz-blue-800) / <alpha-value>)", 900: "rgb(var(--jz-blue-900) / <alpha-value>)" },
        orange: { 50: "rgb(var(--jz-orange-50) / <alpha-value>)", 100: "rgb(var(--jz-orange-100) / <alpha-value>)", 200: "rgb(var(--jz-orange-200) / <alpha-value>)", 300: "rgb(var(--jz-orange-300) / <alpha-value>)", 400: "rgb(var(--jz-orange-400) / <alpha-value>)", 500: "rgb(var(--jz-orange-500) / <alpha-value>)", 600: "rgb(var(--jz-orange-600) / <alpha-value>)", 700: "rgb(var(--jz-orange-700) / <alpha-value>)", 800: "rgb(var(--jz-orange-800) / <alpha-value>)", 900: "rgb(var(--jz-orange-900) / <alpha-value>)" },
        amber: { 50: "rgb(var(--jz-amber-50) / <alpha-value>)", 100: "rgb(var(--jz-amber-100) / <alpha-value>)", 200: "rgb(var(--jz-amber-200) / <alpha-value>)", 300: "rgb(var(--jz-amber-300) / <alpha-value>)", 400: "rgb(var(--jz-amber-400) / <alpha-value>)", 500: "rgb(var(--jz-amber-500) / <alpha-value>)", 600: "rgb(var(--jz-amber-600) / <alpha-value>)", 700: "rgb(var(--jz-amber-700) / <alpha-value>)", 800: "rgb(var(--jz-amber-800) / <alpha-value>)", 900: "rgb(var(--jz-amber-900) / <alpha-value>)" },
        purple: { 50: "rgb(var(--jz-purple-50) / <alpha-value>)", 100: "rgb(var(--jz-purple-100) / <alpha-value>)", 200: "rgb(var(--jz-purple-200) / <alpha-value>)", 300: "rgb(var(--jz-purple-300) / <alpha-value>)", 400: "rgb(var(--jz-purple-400) / <alpha-value>)", 500: "rgb(var(--jz-purple-500) / <alpha-value>)", 600: "rgb(var(--jz-purple-600) / <alpha-value>)", 700: "rgb(var(--jz-purple-700) / <alpha-value>)", 800: "rgb(var(--jz-purple-800) / <alpha-value>)", 900: "rgb(var(--jz-purple-900) / <alpha-value>)" },
      },
      fontFamily: { sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 6px 12px rgba(15, 23, 42, 0.08)",
        hero: "0 10px 20px rgba(0, 0, 0, 0.18)",
        cta: "0 4px 8px rgb(var(--jz-primary) / 0.25)",
        login: "0 14px 22px rgba(0, 0, 0, 0.28)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, rgb(var(--jz-primary-deep)) 0%, rgb(var(--jz-primary-dark)) 50%, rgb(var(--jz-primary)) 100%)",
      },
      keyframes: {
        pulseSoft: { "0%,100%": { opacity: "0.45" }, "50%": { opacity: "0.9" } },
        dot: { "0%,100%": { opacity: "0.3", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.35)" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        pop: { "0%": { transform: "scale(.94)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        // BlinkingEyeIcon: close-open, close-open, rest.
        blink: {
          "0%,4.3%,8.6%,100%": { transform: "scaleY(1)" },
          "2.1%,6.4%": { transform: "scaleY(0.1)" },
        },
        // WavingHandIcon: four quick swings (~720ms), then a ~2.8s rest.
        wave: {
          "0%": { transform: "rotate(0)" },
          "5%": { transform: "rotate(20deg)" },
          "10%": { transform: "rotate(-14deg)" },
          "15%": { transform: "rotate(18deg)" },
          "20%,100%": { transform: "rotate(0)" },
        },
      },
      animation: {
        skeleton: "pulseSoft 1.4s ease-in-out infinite",
        dot: "dot 1.1s ease-in-out infinite",
        fadeUp: "fadeUp .25s ease-out both",
        pop: "pop .18s ease-out both",
        wave: "wave 3.5s ease-in-out infinite",
        blink: "blink 4.2s linear infinite",
      },
    },
  },
  plugins: [],
};
