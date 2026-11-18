import { useEffect, useRef, useState } from "react";
import { GOOGLE_BUTTON_ENABLED, promptGoogleSignIn, renderGoogleButton } from "@/lib/googleIdentity";
import { useNavigate } from "react-router";
import { paths } from "@/routes/paths";
import { peekReturnTo } from "@/routes/returnTo";
import { signInWithGoogle } from "@app/lib/googleAuth";
import { signInWithApple } from "@app/lib/appleAuth";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import Spinner from "@/components/ui/Spinner";
import { Ionicon } from "@/components/icons/Icon";
import GoogleIcon from "@/components/GoogleIcon";
import Modal from "@/components/ui/Modal";
import TermsContent from "@/components/onboarding/TermsContent";
import SiteFooter from "@/components/site/SiteFooter";
import ThemeToggle from "@/components/ThemeToggle";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { colors } from "@app/constants/theme";
import { getResolvedTheme, useThemeStore } from "@app/store/themeStore";
import heroCommunity from "@/assets/web/slide-venues.webp";
import heroChallenge from "@/assets/web/slide-fourth.webp";

const APPLE_ENABLED = import.meta.env.VITE_ENABLE_APPLE_SIGNIN === "true";

// Hero background: real players from the app's promo artwork, crossfading.
// Each image has its own headline on the left, which the hero's fade covers.
// (The other slides show a phone/map mockup, which reads as clutter here.)
const HERO_PHOTOS = [heroCommunity, heroChallenge];
const HERO_PHOTO_MS = 7000;

// The hero follows the light/dark theme: deep green with white text in dark,
// white with the app's ink and green in light. `base` is the fade colour.
const HERO_THEME = {
  dark: {
    base: "6,42,25",
    pill: "bg-white/10 text-[#86EFAC] ring-white/15",
    pillIcon: "#86EFAC",
    title: "text-white",
    accent: "text-[#4ADE80]",
    body: "text-white/80",
    item: "text-white/90",
    itemIcon: "bg-white/15",
    itemIconColor: "#6EE7B0",
    sports: "text-white/70",
  },
  light: {
    base: "255,255,255",
    pill: "bg-primary-light text-primary-dark ring-primary/20",
    pillIcon: "",
    title: "text-ink",
    accent: "text-primary",
    body: "text-ink-secondary",
    item: "text-ink",
    itemIcon: "bg-primary-light",
    itemIconColor: "",
    sports: "text-ink-secondary",
  },
} as const;

// Desktop fade, anchored to the content column so the photo's own headline
// stays covered on wide screens: solid under the copy, clear behind the card.
const heroFade = (rgb: string) =>
  `linear-gradient(90deg, rgb(${rgb}) 0%, rgb(${rgb}) max(36%, calc(50% - 38rem + 540px)), rgba(${rgb},0.88) max(48%, calc(50% - 38rem + 700px)), rgba(${rgb},0.35) max(64%, calc(50% - 38rem + 940px)), rgba(${rgb},0.08) 100%)`;

const HIGHLIGHTS: { icon: string; label: string }[] = [
  { icon: "people", label: "Find players & squads" },
  { icon: "calendar", label: "Join games & tournaments" },
  { icon: "location", label: "Book courts near you" },
  { icon: "stats-chart", label: "Live scorecards" },
];

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "location", title: "Courts & turfs near you", body: "Browse venues with photos, sports, prices and opening hours, sorted by distance. Featured venues come first." },
  { icon: "tennisball", title: "Games & tournaments", body: "Join pickup games, enter tournaments with fixtures and standings, or organise your own in a few taps." },
  { icon: "people", title: "Squads & teams", body: "Build a squad for your regulars, manage members and keep everyone in the loop with group chat." },
  { icon: "flash", title: "Challenge a team", body: "Send match requests to teams near you, agree a format, and turn accepted challenges into fixtures." },
  { icon: "stats-chart", title: "Live scorecards", body: "Ball-by-ball cricket, football, padel, tennis, badminton, pickleball and table tennis, with full match summaries." },
  { icon: "chatbubbles", title: "Community & events", body: "Find top players, chat with the community, and discover events and training camps around you." },
];

const STEPS: { title: string; body: string }[] = [
  { title: "Sign in with Google", body: "One tap to create your profile. Add your sports and city so we can show what's near you." },
  { title: "Find your game", body: "Pick a venue, join an open game or squad, or challenge a team that plays your sport." },
  { title: "Play and track it", body: "Score the match live, share the summary and build your player stats over time." },
];

// The public landing page. The sign-in card is the app's LoginScreen card
// (logo, "Welcome to HitLit", Google CTA, terms line) inside a website hero,
// followed by features, how it works and a final call to action.
export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState<"google" | "apple" | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const preference = useThemeStore((s) => s.preference);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const theme = getResolvedTheme({ ...useThemeStore.getState(), preference, systemTheme });
  const hero = HERO_THEME[theme === "light" ? "light" : "dark"];
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => setPhoto((i) => (i + 1) % HERO_PHOTOS.length), HERO_PHOTO_MS);
    return () => clearTimeout(t);
  }, [photo, reduceMotion]);

  // Coming back from a failed/cancelled OAuth attempt: surface the
  // provider's message once, then clean the URL. Any other URL (a deep link
  // the visitor opened) is left as-is so they land on it after signing in.
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = params.get("error_description") ?? hash.get("error_description");
    if (window.location.pathname === paths.authCallback || description) {
      navigate(peekReturnTo() ?? paths.home, { replace: true });
    }
    if (description && !/cancel|denied/i.test(description)) {
      Alert.alert("Sign-in failed", description.replace(/\+/g, " "));
    }
  }, [navigate]);

  const handleSignIn = async (provider: "google" | "apple") => {
    setIsSigningIn(provider);
    try {
      await (provider === "google" ? signInWithGoogle() : signInWithApple());
      // The browser is now redirecting to the provider.
    } catch (err) {
      Alert.alert("Sign-in failed", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      setIsSigningIn(null);
    }
  };

  // Google's own button (see lib/googleIdentity): Google then names this
  // site, not the Supabase project, on its account chooser. If Google's
  // script can't load or Google won't show the button for this origin, the
  // card falls back to the redirect sign-in button.
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleButtonFailed, setGoogleButtonFailed] = useState(false);
  const [googleButtonShown, setGoogleButtonShown] = useState(false);
  const useGoogleButton = GOOGLE_BUTTON_ENABLED && !googleButtonFailed;
  useEffect(() => {
    const el = googleButtonRef.current;
    if (!GOOGLE_BUTTON_ENABLED || !el) return;
    renderGoogleButton(el, {
      theme: theme === "light" ? "light" : "dark",
      width: el.clientWidth,
      onStart: () => setIsSigningIn("google"),
      onError: (err) => {
        Alert.alert("Sign-in failed", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
        setIsSigningIn(null);
      },
    })
      .then(() => setGoogleButtonShown(true))
      .catch(() => setGoogleButtonFailed(true));
  }, [theme]);

  const signInCard = (
    <div id="sign-in" className="flex w-full max-w-[420px] scroll-mt-24 flex-col items-center rounded-3xl border-[1.5px] border-[rgba(15,23,42,0.12)] bg-surface/90 px-6 py-8 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-8 sm:py-10">
      <img src="/logo.png" alt="HitLit" className="h-[68px] w-[68px]" />
      <h2 className="mt-4 text-center text-2xl font-extrabold text-ink">Welcome to HitLit</h2>
      <p className="mt-1.5 px-2 text-center text-sm text-muted">Find players, book courts, and get in the game.</p>

      {useGoogleButton ? (
        <div className="relative mt-8 w-full">
          <div ref={googleButtonRef} id="google-signin-button" className="flex min-h-[44px] w-full justify-center" />
          {!googleButtonShown && <div aria-hidden className="pointer-events-none absolute inset-0 animate-skeleton rounded-md bg-gray-200" />}
          {isSigningIn === "google" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface/90" role="status" aria-label="Signing in">
              <Spinner />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => handleSignIn("google")}
          disabled={!!isSigningIn}
          className="press mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-brand py-3.5 shadow-cta transition hover:brightness-110 disabled:opacity-70"
        >
          {isSigningIn === "google" ? (
            <Spinner color="white" />
          ) : (
            <>
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface">
                <GoogleIcon size={16} />
              </span>
              <span className="text-base font-semibold text-white">Sign In with Google</span>
            </>
          )}
        </button>
      )}

      {APPLE_ENABLED && (
        <button
          type="button"
          onClick={() => handleSignIn("apple")}
          disabled={!!isSigningIn}
          className="press mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-black text-white hover:bg-neutral-900 disabled:opacity-70"
        >
          {isSigningIn === "apple" ? (
            <Spinner color="white" />
          ) : (
            <>
              <Ionicon name="logo-apple" size={20} color="white" />
              <span className="text-base font-semibold">Sign in with Apple</span>
            </>
          )}
        </button>
      )}

      {/* Terms are readable here; acceptance is recorded right after sign-in. */}
      <button type="button" onClick={() => setTermsOpen(true)} className="mt-6 text-center text-xs font-bold text-primary hover:underline">
        View Terms of Service and Privacy Policy
      </button>
    </div>
  );

  // Header "Sign in": with Google as the only provider it signs in straight
  // away (scrolling to a card that's already on screen looks like nothing
  // happened). With Apple enabled too, it takes you to the card to choose.
  // With Google's own button, which can only be opened by clicking it, this
  // brings the card into view and asks Google for its sign-in prompt.
  const headerSignIn = () => {
    if (!APPLE_ENABLED && !useGoogleButton) return handleSignIn("google");
    const card = document.getElementById("sign-in");
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (useGoogleButton) return promptGoogleSignIn();
    card?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="site-container flex h-16 items-center gap-4">
          <a href="/" className="flex items-center gap-2.5" aria-label="HitLit home">
            <img src="/logo.png" alt="" className="h-9 w-9" />
            <span className="text-[21px] font-extrabold tracking-tight text-ink">
              Hit<span className="text-primary">Lit</span>
            </span>
          </a>
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            <a href="#features" className="rounded-xl px-3.5 py-2 text-[15px] font-semibold text-ink-secondary transition-colors hover:bg-gray-50 hover:text-ink">Features</a>
            <a href="#how-it-works" className="rounded-xl px-3.5 py-2 text-[15px] font-semibold text-ink-secondary transition-colors hover:bg-gray-50 hover:text-ink">How it works</a>
            <a href="/privacy" className="rounded-xl px-3.5 py-2 text-[15px] font-semibold text-ink-secondary transition-colors hover:bg-gray-50 hover:text-ink">Privacy</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={headerSignIn}
              disabled={!!isSigningIn}
              className="press flex min-w-[88px] items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-cta transition hover:brightness-110 disabled:opacity-70"
            >
              {isSigningIn ? <Spinner size={18} color="white" /> : "Sign in"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative isolate overflow-hidden" style={{ backgroundColor: `rgb(${hero.base})` }}>
          {/* Background: players from the app's artwork, slowly crossfading. */}
          <div aria-hidden className="absolute inset-0 -z-10">
            {/* Desktop: zoomed from the bottom-right so the artwork's own
                labels (top and left) fall outside and the players fill it.
                Capped at 1440px wide (right-aligned, its left edge under the
                solid fade) so wide screens get the same framing. */}
            <div className="absolute inset-y-0 right-0 w-full max-w-[1440px] blur-[2px] lg:origin-bottom-right lg:scale-[1.42] lg:blur-none xl:scale-[1.28]">
              {HERO_PHOTOS.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`absolute inset-0 h-full w-full object-cover object-[78%_center] transition-[opacity,transform] duration-[1400ms] ease-out lg:object-right-bottom ${
                    i === photo ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
                  }`}
                />
              ))}
            </div>
            {/* Phones/tablets: the copy spans the width, so the whole photo is toned down. */}
            <div className="absolute inset-0 lg:hidden" style={{ backgroundColor: `rgba(${hero.base},0.88)` }} />
            {/* Desktop: solid under the copy, photo showing on the right. */}
            <div className="absolute inset-0 hidden lg:block" style={{ backgroundImage: heroFade(hero.base) }} />
            <div className="absolute inset-x-0 bottom-0 h-32" style={{ backgroundImage: `linear-gradient(to top, rgba(${hero.base},0.7), transparent)` }} />
          </div>

          <div className="site-container relative grid items-center gap-10 py-14 sm:py-16 lg:min-h-[640px] lg:grid-cols-[1.15fr_1fr] lg:py-20">
            <div className="animate-fadeUp">
              <p className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 backdrop-blur-sm ${hero.pill}`}>
                <Ionicon name="flash" size={13} color={hero.pillIcon || colors.primaryDark} />
                Your city's sports community, in one place
              </p>
              <h1 className={`mt-5 text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[68px] ${hero.title}`}>
                Book. Play.
                <br />
                <span className={hero.accent}>Enjoy.</span>
              </h1>
              <p className={`mt-5 max-w-xl text-base leading-relaxed sm:text-lg ${hero.body}`}>
                Find players and squads, join games and tournaments, discover courts and turfs near you, and keep live scorecards, all from one account.
              </p>
              <ul className="mt-8 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                {HIGHLIGHTS.map((h) => (
                  <li key={h.label} className={`flex items-center gap-2.5 text-sm font-medium ${hero.item}`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${hero.itemIcon}`}>
                      <Ionicon name={h.icon} size={16} color={hero.itemIconColor || colors.primary} />
                    </span>
                    {h.label}
                  </li>
                ))}
              </ul>
              <p className={`mt-8 text-[13px] font-medium ${hero.sports}`}>
                Cricket · Football · Padel · Tennis · Badminton · Pickleball · Table tennis
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">{signInCard}</div>
          </div>
        </section>

        <section id="features" className="site-container scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Everything you need to play</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">One place for every game you play</h2>
            <p className="mt-4 text-base text-muted sm:text-lg">From finding a court to keeping the score, HitLit covers the whole match day.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="card lift p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light">
                  <Ionicon name={f.icon} size={24} color={colors.primary} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface py-16 lg:py-24">
          <div className="site-container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Get in the game in three steps</h2>
            </div>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative text-center md:text-left">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-white shadow-cta md:mx-0">{i + 1}</span>
                  <h3 className="mt-5 text-lg font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="site-container py-16 lg:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-12 text-center shadow-hero sm:px-12 lg:py-16">
            <span aria-hidden className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full border-[36px] border-white/[0.06]" />
            <span aria-hidden className="pointer-events-none absolute -bottom-32 -right-10 h-72 w-72 rounded-full bg-white/[0.05]" />
            <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">Ready to play?</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-white/80">Sign in with Google and find your next game in minutes.</p>
            <button
              type="button"
              onClick={() => (useGoogleButton ? headerSignIn() : handleSignIn("google"))}
              disabled={!!isSigningIn}
              className="press relative mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-primary-deep shadow-hero transition hover:bg-[#ECFDF3] disabled:opacity-70"
            >
              <GoogleIcon size={18} />
              Get started with Google
            </button>
          </div>
        </section>
      </main>

      <SiteFooter signedIn={false} />

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title="Terms of Service">
        <TermsContent />
        <a href="/privacy" className="mt-5 block text-center text-sm font-semibold text-primary hover:underline">
          Read the full Privacy Policy
        </a>
      </Modal>
    </div>
  );
}
