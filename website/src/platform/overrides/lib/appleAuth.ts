import { supabase } from "./supabase";
import { authRedirectUrl } from "./googleAuth";

/**
 * Web version: Supabase's Apple OAuth redirect (needs the Apple provider's
 * Services ID configured for web in Supabase). Apple only shares the user's
 * name on the very first authorization; with the web flow Supabase stores it
 * in the user's metadata itself, so there's no client-side name capture here.
 */
export async function signInWithApple() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: authRedirectUrl() },
  });
  if (error) throw error;
  return null;
}
