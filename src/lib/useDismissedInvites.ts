import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "dismissed-invite-banners";

async function readAll(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The corner "X" on an invite banner (game/tournament/squad "you're
// invited" cards) only hides that banner on this device — it never touches
// the invite's own status, so it's still sitting there, fully actionable,
// in the Notifications list (or if the user revisits after this is cleared
// by reinstalling, etc). Persisted so "ignore" actually sticks instead of
// reappearing the next time the screen is reopened.
export function useDismissedInvites() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    readAll().then((ids) => {
      if (!cancelled) setDismissed(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  const isDismissed = useCallback((id: string) => dismissed.has(id), [dismissed]);

  return { isDismissed, dismiss };
}
