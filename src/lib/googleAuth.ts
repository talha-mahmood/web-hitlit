import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabase";

// webClientId must be the Web Application OAuth client from Google Cloud Console.
// Google uses it server-side to verify the ID token before Supabase trusts it.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ["openid", "profile", "email"],
});

/**
 * Opens the native Android/iOS Google account picker, exchanges the resulting
 * ID token for a Supabase session. No WebBrowser or redirect URL involved.
 * Returns null if the user dismisses the picker.
 */
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type !== "success") {
    return null; // user dismissed the picker
  }

  const idToken = response.data.idToken;
  if (!idToken) throw new Error("Google sign-in did not return an ID token.");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  return data.session;
}

export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // swallow — Supabase signOut is the authoritative logout
  }
}
