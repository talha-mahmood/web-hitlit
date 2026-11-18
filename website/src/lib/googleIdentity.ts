import { supabase } from "@app/lib/supabase";
import { clearReturnTo } from "@/routes/returnTo";

// Website Google sign-in with Google's own "Sign in with Google" button
// (Google Identity Services). Google returns an ID token to this page and it
// is exchanged for a Supabase session with signInWithIdToken, the same call
// the mobile app makes after its native picker. Because the page itself
// receives the token (no redirect through <project>.supabase.co), Google's
// account chooser says "to continue to <this site's domain>".
//
// Needs VITE_GOOGLE_WEB_CLIENT_ID: the app's Web OAuth client
// (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID), with the site's origins listed under
// "Authorized JavaScript origins" in Google Cloud Console. Without it the
// login page keeps Supabase's redirect sign-in.
const CLIENT_ID = ((import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "").trim();
export const GOOGLE_BUTTON_ENABLED = CLIENT_ID.length > 0;

type GoogleId = {
  initialize(options: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;
function loadGoogleId(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google sign-in did not load."));
    };
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Google sign-in could not load."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// Google gets the SHA-256 of a random nonce; Supabase gets the raw value and
// checks it against the token, so a token can't be replayed elsewhere.
async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export type GoogleButtonOptions = {
  theme: "light" | "dark";
  width: number;
  /** A credential came back; the session exchange is starting. */
  onStart: () => void;
  onError: (err: unknown) => void;
};

/**
 * Renders Google's button into `parent`. Rejects if Google's script can't
 * load, or if Google never shows the button (it stays 0px wide when the
 * client ID is wrong or this origin isn't authorised for it).
 */
export async function renderGoogleButton(parent: HTMLElement, opts: GoogleButtonOptions): Promise<void> {
  await renderInto(parent, opts);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if ((parent.querySelector("iframe")?.getBoundingClientRect().width ?? 0) > 0) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Google sign-in button was not shown for this site.");
}

async function renderInto(parent: HTMLElement, opts: GoogleButtonOptions): Promise<void> {
  const [googleId, nonce] = await Promise.all([loadGoogleId(), makeNonce()]);
  googleId.initialize({
    client_id: CLIENT_ID,
    nonce: nonce.hashed,
    ux_mode: "popup",
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
    use_fedcm_for_prompt: true,
    callback: async ({ credential }: { credential?: string }) => {
      if (!credential) return;
      opts.onStart();
      try {
        const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: nonce.raw });
        if (error) throw error;
        // Signed in on the page the visitor is already on (the gate swaps the
        // login page for it), so a remembered deep link is no longer needed.
        clearReturnTo();
      } catch (err) {
        opts.onError(err);
      }
    },
  });
  googleId.renderButton(parent, {
    type: "standard",
    theme: opts.theme === "dark" ? "filled_black" : "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "center",
    width: Math.round(Math.min(400, Math.max(200, opts.width))),
  });
}

/** Google's One Tap / browser sign-in prompt (may be suppressed by Google). */
export function promptGoogleSignIn() {
  loadGoogleId()
    .then((id) => id.prompt())
    .catch(() => {});
}
