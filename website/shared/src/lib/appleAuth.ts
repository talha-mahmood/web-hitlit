import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabase";
import { useProfileStore } from "../store/profileStore";

/**
 * Opens Apple's native sign-in sheet, exchanges the resulting identity token
 * for a Supabase session. Returns null if the user cancels.
 */
export async function signInWithApple() {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ERR_REQUEST_CANCELED") {
      return null; // user dismissed the sheet
    }
    throw err;
  }

  const { identityToken } = credential;
  if (!identityToken) throw new Error("Apple sign-in did not return an identity token.");

  // Holds RootNavigator on the splash screen (see profileStore.ts) from the
  // instant the session exists until the block below is fully done — closes
  // the race where Supabase's own auth-state listener fires (triggering the
  // app's normal profile fetch) before the name-save below has landed.
  const { setPendingNameCapture, fetchProfile } = useProfileStore.getState();
  setPendingNameCapture(true);
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });
    if (error) throw error;

    // Apple hands over the user's name only on the very first authorization
    // ever for this Apple ID + app, and never again after that — unlike
    // Google's ID token, Apple's carries no name claim Supabase could pick up
    // on its own, so the app has to capture it right here or lose it for
    // good. There's deliberately no screen in this app that re-asks for the
    // name if this misses it — App Review (Guideline 4.x) rejects apps that
    // do that, since Apple already supplied it once.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join(" ")
      .trim();
    if (data.session && fullName) {
      try {
        // Only fills an empty name — never overwrites one the user already
        // has (e.g. edited later in Account Settings, or from a prior login).
        await supabase
          .from("profiles")
          .update({ full_name: fullName })
          .eq("id", data.session.user.id)
          .eq("full_name", "");
      } catch {
        // Best-effort: worst case the profile is just left without a name
        // (same as any provider that never supplies one) — never re-asked.
      }
    }

    // Make sure the local store actually has the saved name (not just the
    // database) before anything downstream is allowed to decide which
    // screen to show — the realtime subscription would eventually deliver
    // the same update, but not necessarily before that decision is made.
    if (data.session) await fetchProfile(data.session.user.id);

    return data.session;
  } finally {
    setPendingNameCapture(false);
  }
}
