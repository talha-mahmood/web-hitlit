import { useEffect, useRef } from "react";
import { useProfileStore, type Profile } from "@app/store/profileStore";

// The site opens offline (service worker), but the profile is fetched from
// Supabase on every load. Offline that fetch fails, the profile stays null,
// and the gate would wrongly show Accept Terms / Complete Details. Keep the
// last loaded profile in this browser and use it only in that situation.
const KEY = "hitlit.profile.lastKnown";

function read(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function write(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: offline reloads just behave like before.
  }
}

export function useOfflineProfileFallback(userId: string | undefined, isInitializing: boolean) {
  const profile = useProfileStore((s) => s.profile);
  const isLoading = useProfileStore((s) => s.isLoading);
  const lastUserId = useRef<string | undefined>(undefined);

  // Remember the latest profile; forget it on sign-out (a real sign-out, not
  // the empty session before auth has restored).
  useEffect(() => {
    if (userId) lastUserId.current = userId;
    else if (!isInitializing && lastUserId.current) {
      lastUserId.current = undefined;
      write(null);
    }
  }, [userId, isInitializing]);
  useEffect(() => {
    if (profile && userId && profile.id === userId) write(profile);
  }, [profile, userId]);

  // Fetch finished without a profile while offline → use the remembered one.
  useEffect(() => {
    if (!userId || profile || isLoading || navigator.onLine) return;
    const cached = read();
    if (cached?.id === userId) useProfileStore.setState({ profile: cached });
  }, [userId, profile, isLoading]);
}
