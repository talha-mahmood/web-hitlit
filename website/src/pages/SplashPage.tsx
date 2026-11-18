import { getResolvedTheme, useThemeStore } from "@app/store/themeStore";

// The app's splash artwork for the active theme (dark is the default).
export function splashImage(theme = getResolvedTheme()) {
  return theme === "dark" ? "/splash-background-dark.webp" : "/splash-background.webp";
}

// The app's splash: brand artwork with four pulsing green dots + "Loading".
// Phones get the full-bleed artwork like the app; wider screens show it as
// a centered portrait panel on the page canvas so it isn't cropped.
export default function SplashPage() {
  const preference = useThemeStore((s) => s.preference);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const theme = getResolvedTheme({ ...useThemeStore.getState(), preference, systemTheme });
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-app">
      <div
        className="relative h-full w-full bg-cover bg-center sm:h-[min(92dvh,860px)] sm:w-auto sm:rounded-[36px] sm:shadow-hero"
        style={{ backgroundImage: `url(${splashImage(theme)})`, aspectRatio: "853 / 1844" }}
      >
        <div className="absolute inset-x-0 bottom-[72px] flex flex-col items-center">
          <div className="flex items-center" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="mx-1.5 h-3 w-3 animate-dot rounded-full bg-[#6EE7B0]" style={{ animationDelay: `${i * 180}ms` }} />
            ))}
          </div>
          <p className="mt-4 text-[13px] font-medium text-muted" role="status">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
