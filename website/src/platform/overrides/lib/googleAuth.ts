import { supabase } from "./supabase";

export function authRedirectUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Web version: Supabase's Google OAuth redirect. The browser leaves the site
 * and comes back to /auth/callback with the session, so this resolves to
 * null (there's no session to hand back synchronously) — same "null means no
 * session yet" contract as the native picker being dismissed.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      scopes: "openid profile email",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  return null;
}

export async function signOutGoogle() {
  // Nothing to clear on the web — Supabase signOut is the authoritative logout.
}
