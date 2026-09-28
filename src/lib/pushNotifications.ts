import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

// Show the banner + play the sound even while the app is open, the same way a
// chat app does — otherwise a notification arriving in the foreground would
// be silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Renamed from "default": Android never lets an app edit a channel after it
// exists, and an earlier build created that one with a broken sound setting.
const CHANNEL_ID = "playoye-alerts";

let registeredToken: string | null = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Android 8+ decides sound/heads-up from the channel, so it must be created
  // (MAX importance = heads-up banner + sound) before the first push arrives.
  // No `sound` here on purpose: that option means "custom sound file", and
  // omitting it gives the phone's normal notification sound.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "HitLit notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#16A34A",
  });
}

/**
 * Asks for notification permission, gets this device's Expo push token and
 * stores it against the signed-in user so the backend can push to it.
 * Never throws — a device that can't do push (simulator, no Play Services,
 * permission denied) must not break sign-in or any other part of the app.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    const { error } = await supabase.rpc("register_push_token", {
      p_token: token,
      p_platform: Platform.OS === "ios" ? "ios" : "android",
    });
    if (!error) registeredToken = token;
  } catch {
    // Intentionally silent — see doc comment above.
  }
}

/** Stops this device receiving the signed-in user's notifications. */
export async function unregisterPushToken(): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await supabase.rpc("unregister_push_token", { p_token: token });
  } catch {
    // Best effort.
  }
}

// Sign-out must drop the device token while the session is still valid,
// otherwise the previous account's notifications keep ringing on this phone.
export async function signOutWithPushCleanup() {
  await unregisterPushToken();
  return supabase.auth.signOut();
}
