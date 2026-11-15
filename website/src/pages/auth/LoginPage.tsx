import { useEffect, useState } from "react";
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
import { splashImage } from "@/pages/SplashPage";
import TermsContent from "@/components/onboarding/TermsContent";

const APPLE_ENABLED = import.meta.env.VITE_ENABLE_APPLE_SIGNIN === "true";

const HIGHLIGHTS: { icon: string; label: string }[] = [
  { icon: "people", label: "Find players & squads" },
  { icon: "calendar", label: "Join games & tournaments" },
  { icon: "location", label: "Book courts near you" },
  { icon: "stats-chart", label: "Live scorecards" },
];

// Same card as the app's LoginScreen (logo, "Welcome to HitLit", Google CTA,
// terms line). On desktop it sits beside the brand artwork.
export default function LoginPage() {
  const [isSigningIn, setIsSigningIn] = useState<"google" | "apple" | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

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

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside
        className="relative hidden flex-1 overflow-hidden bg-app lg:block"
        style={{ backgroundImage: `url(${splashImage()})`, backgroundSize: "cover", backgroundPosition: "center 30%" }}
      >
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07301D]/90 via-[#07301D]/50 to-transparent px-12 pb-12 pt-32">
          <h2 className="max-w-md text-3xl font-extrabold leading-tight text-white">
            Your city's sports community, in one place.
          </h2>
          <ul className="mt-6 grid max-w-lg grid-cols-2 gap-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.label} className="flex items-center gap-2.5 text-sm font-medium text-white/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Ionicon name={h.icon} size={16} color="#6EE7B0" />
                </span>
                {h.label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[520px] lg:shrink-0">
        <div className="flex w-full max-w-[400px] flex-col items-center rounded-3xl border-[1.5px] border-[rgba(15,23,42,0.12)] bg-surface px-6 py-8 shadow-login">
          <img src="/icon-192.png" alt="HitLit" className="h-[68px] w-[68px] rounded-full" />
          <h1 className="mt-4 text-center text-xl font-extrabold text-ink">Welcome to HitLit</h1>
          <p className="mt-1.5 px-2 text-center text-sm text-muted">Find players, book courts, and get in the game.</p>

          <button
            type="button"
            onClick={() => handleSignIn("google")}
            disabled={!!isSigningIn}
            className="press mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-brand py-3.5 shadow-cta hover:brightness-110 disabled:opacity-70"
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

          {APPLE_ENABLED && (
            <button
              type="button"
              onClick={() => handleSignIn("apple")}
              disabled={!!isSigningIn}
              className="press mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-black text-white hover:bg-neutral-900 disabled:opacity-70"
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


      </main>

      <Modal open={termsOpen} onClose={() => setTermsOpen(false)} title="Terms of Service">
        <TermsContent />
        <a href="/privacy" className="mt-5 block text-center text-sm font-semibold text-primary hover:underline">
          Read the full Privacy Policy
        </a>
      </Modal>
    </div>
  );
}
