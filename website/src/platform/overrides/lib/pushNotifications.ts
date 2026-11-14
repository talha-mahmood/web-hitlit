import { supabase } from "./supabase";

// Web: device push (Expo push tokens) is a mobile-only channel. In-app
// notifications still arrive live through the notifications list/badge.
export async function registerForPushNotifications(): Promise<void> {}

export async function unregisterPushToken(): Promise<void> {}

export async function signOutWithPushCleanup() {
  return supabase.auth.signOut();
}
