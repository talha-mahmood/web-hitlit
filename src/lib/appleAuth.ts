import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabase";

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

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
  });
  if (error) throw error;
  return data.session;
}
