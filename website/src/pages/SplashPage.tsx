import { getResolvedTheme, useThemeStore } from "@app/store/themeStore";

// The app's splash artwork for the active theme (dark is the default).
export function splashImage(theme = getResolvedTheme()) {
  return theme === "dark" ? "/splash-background-dark.webp" : "/splash-background.webp";
}

function LoadingDots() {
  return (
    <div className="flex items-center" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="mx-1.5 h-2.5 w-2.5 animate-dot rounded-full bg-primary" style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </div>
  );
}

// Loading screen while the session and profile load.
// Phones: the app's full-bleed splash artwork with the four pulsing dots.
// Tablets and desktops: a full-window website loader (logo, wordmark,
// tagline, dots) on the page background, instead of a phone-shaped card.
export default function SplashPage() {
  const preference = useThemeStore((s) => s.preference);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const theme = getResolvedTheme({ ...useThemeStore.getState(), preference, systemTheme });
  return (
    <div className="fixed inset-0 bg-app" role="status" aria-label="Loading HitLit">
      {/* Phones */}
      <div className="absolute inset-0 bg-cover bg-center sm:hidden" style={{ backgroundImage: `url(${splashImage(theme)})` }}>
        <div className="absolute inset-x-0 bottom-[72px] flex flex-col items-center">
          <LoadingDots />
          <p className="mt-4 text-[13px] font-medium text-muted">Loading</p>
        </div>
      </div>

      {/* Tablets and desktops */}
      <div className="absolute inset-0 hidden overflow-hidden sm:block">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--jz-primary)/0.16),transparent)]" />
        <div aria-hidden className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full border-[56px] border-primary/[0.06]" />
        <div aria-hidden className="absolute -bottom-52 -right-40 h-[560px] w-[560px] rounded-full bg-primary/[0.05]" />

        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="relative flex items-center justify-center">
            <span aria-hidden className="absolute h-36 w-36 animate-skeleton rounded-full bg-primary/15" />
            <img src="/logo.png" alt="" className="relative h-24 w-24 drop-shadow-[0_10px_24px_rgba(18,155,83,0.35)]" />
          </div>
          <p className="mt-8 text-5xl font-extrabold tracking-tight text-ink">
            Hit<span className="text-primary">Lit</span>
          </p>
          <p className="mt-3 text-lg font-medium text-ink-secondary">Find. Play. Compete.</p>
          <div className="mt-10">
            <LoadingDots />
          </div>
          <p className="mt-4 text-sm font-medium text-muted">Loading</p>
        </div>
      </div>
    </div>
  );
}
