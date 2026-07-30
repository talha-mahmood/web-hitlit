import * as WebBrowser from "expo-web-browser";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "./supabase";

// Required once at module load so the auth session popup can close itself on web.
WebBrowser.maybeCompleteAuthSession();

// Resolves to an `exp://...` URI in Expo Go/dev and to the `playpals://` custom
// scheme in a dev client or standalone/production build - no branching needed.
const redirectTo = makeRedirectUri();

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Opens the Google OAuth consent screen in an in-app browser and exchanges the
 * resulting redirect for a Supabase session. Requires the Google provider to be
 * enabled in the Supabase Dashboard (Authentication > Providers) and this app's
 * redirect URIs to be whitelisted there (Authentication > URL Configuration).
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned by Supabase.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success") {
    return createSessionFromUrl(result.url);
  }
  if (result.type === "cancel" || result.type === "dismiss") {
    return null;
  }
  throw new Error("Google sign-in failed. Please try again.");
}
