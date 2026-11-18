// Web version of src/lib/supabase.ts — same project, same typed client.
// Differences are only what the browser needs: sessions persist in
// localStorage (the default) instead of AsyncStorage, and Google/Apple sign-in
// is an OAuth redirect (PKCE) that lands back on /auth/callback, so the
// session has to be picked up from the URL.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@app/types/database.types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check website/.env.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

// Mirrors the app's AppState handling: only run the token refresh loop
// while the tab is actually visible.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
