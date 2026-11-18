import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { OFFLINE_PATTERN } from "./friendlyError";

// Last-known-good copy of a live match's full detail, per sport. Lets a
// match screen still open to something (rather than an error) if the app
// is killed and reopened while offline mid-match — the live network fetch
// fails, this is the fallback. Pending (not-yet-synced) balls/points queued
// in offlineQueue.ts are merged on top of whichever of the two loaded.
function storageKey(namespace: string, matchId: string): string {
  return `match-snapshot:${namespace}:${matchId}`;
}

export async function saveMatchSnapshot<T>(namespace: string, matchId: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(namespace, matchId), JSON.stringify(data));
  } catch {
    // Snapshotting is a best-effort convenience — never let a storage
    // failure interrupt the actual (successful) network fetch it's for.
  }
}

export async function loadMatchSnapshot<T>(namespace: string, matchId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(namespace, matchId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Every sport's useXMatch query calls this as its queryFn instead of the
// raw network fetch directly. On a genuine (non-connectivity) error, or a
// successful fetch, it behaves exactly like the plain fetch. Offline, it
// deliberately prefers whatever's ALREADY in the live query cache over the
// AsyncStorage snapshot — the in-memory cache, if present at all, reflects
// every optimistic scoring update made so far this session (balls, innings,
// match completion, ...), while the snapshot is frozen at whenever the last
// *successful* fetch happened, which can be well before that. Returning the
// snapshot unconditionally — the original, simpler version of this —
// clobbered all of that newer-but-still-local progress a few seconds into
// every offline screen, since staleTime: 0 fires a background refetch on
// every mount/focus. The snapshot is only actually used when the cache is
// truly empty: a cold app start, offline, before this match has been
// fetched at all this session.
export async function fetchMatchWithOfflineFallback<T>(
  namespace: string,
  matchId: string,
  queryKey: QueryKey,
  qc: QueryClient,
  networkFetch: () => Promise<T>
): Promise<T> {
  try {
    const data = await networkFetch();
    saveMatchSnapshot(namespace, matchId, data);
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (OFFLINE_PATTERN.test(message)) {
      const cached = qc.getQueryData<T>(queryKey);
      if (cached) return cached;
      const snapshot = await loadMatchSnapshot<T>(namespace, matchId);
      if (snapshot) return snapshot;
    }
    throw err;
  }
}
