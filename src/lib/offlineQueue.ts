import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A small, sport-agnostic "pending writes" queue for live scoring. Every
// sport's scoring mutation is a single dumb insert (one ball/point/goal row,
// no server-side logic to replicate), so offline support here just means:
// keep trying the real insert, and whenever it fails specifically because
// there's no connection, remember it locally (survives the app being
// killed) instead of losing it, then replay it once back online.
//
// Deliberately NOT used for deletes ("undo") of a ball that's already
// synced — undoing while offline only removes a still-pending (unsynced)
// entry locally; undoing an already-synced ball requires a connection. See
// each sport's hook for how that's handled.
export type QueuedItem<T> = {
  localId: string;
  matchId: string;
  createdAt: number;
  payload: T;
};

function storageKey(namespace: string): string {
  return `offline-queue:${namespace}`;
}

// AsyncStorage itself isn't reactive — this is what lets the "N pending,
// will sync when back online" banner (and the scoring screens' ballEvents)
// update immediately after a queue write, via useSyncExternalStore in each
// sport's useXOfflineQueue hook, instead of only refreshing on next mount.
const listeners = new Map<string, Set<() => void>>();

function notify(namespace: string): void {
  listeners.get(namespace)?.forEach((cb) => cb());
}

export function subscribeQueue(namespace: string, callback: () => void): () => void {
  if (!listeners.has(namespace)) listeners.set(namespace, new Set());
  listeners.get(namespace)!.add(callback);
  return () => listeners.get(namespace)?.delete(callback);
}

async function readAll<T>(namespace: string): Promise<QueuedItem<T>[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(namespace));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupted/unreadable queue should never crash scoring — worst case
    // is the same as never having queued anything.
    return [];
  }
}

async function writeAll<T>(namespace: string, items: QueuedItem<T>[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(namespace), JSON.stringify(items));
}

// Every write below is a read-modify-write (read the array, change it,
// write the whole thing back) with no atomic update in AsyncStorage itself —
// two of those overlapping (very possible: fast-tapping runs scores while
// offline faster than a single AsyncStorage round trip) would let the
// second write silently clobber the first's change. This chains every
// operation for a given namespace onto the one before it, per namespace, so
// they always run one at a time in the order they were called.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(namespace: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(namespace) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Swallow rejections here only so one failed operation doesn't wedge the
  // chain for every operation after it — the real result/error still goes
  // to whoever called withLock, via `next` below.
  locks.set(namespace, next.catch(() => undefined));
  return next;
}

export async function enqueue<T>(namespace: string, matchId: string, payload: T): Promise<QueuedItem<T>> {
  return withLock(namespace, async () => {
    const item: QueuedItem<T> = {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      matchId,
      createdAt: Date.now(),
      payload,
    };
    const items = await readAll<T>(namespace);
    items.push(item);
    await writeAll(namespace, items);
    notify(namespace);
    return item;
  });
}

export async function getQueueForMatch<T>(namespace: string, matchId: string): Promise<QueuedItem<T>[]> {
  const items = await readAll<T>(namespace);
  return items.filter((i) => i.matchId === matchId);
}

// Every match/point/goal queue above is only ever flushed by the one screen
// that's currently showing that specific match (via useXMatch's own
// reconnect effect), which works because that screen is still open when
// the connection comes back. A tournament-result sync has no such
// guarantee — the match it's for is typically finished and the user has
// already navigated away (often straight to the match list) by the time
// they reconnect, so nothing with that matchId is mounted to flush it. This
// reads an entire namespace's queue across every match at once, for a
// flush that runs globally (see RootNavigator) instead of per-screen.
export async function getAllQueued<T>(namespace: string): Promise<QueuedItem<T>[]> {
  return readAll<T>(namespace);
}

export async function removeFromQueue(namespace: string, localId: string): Promise<void> {
  return withLock(namespace, async () => {
    const items = await readAll(namespace);
    await writeAll(
      namespace,
      items.filter((i) => i.localId !== localId)
    );
    notify(namespace);
  });
}

// Used by "undo" when the last ball/point is still only local — removes it
// without ever having touched the network.
export async function removeLastForMatch<T>(namespace: string, matchId: string): Promise<QueuedItem<T> | null> {
  return withLock(namespace, async () => {
    const items = await readAll<T>(namespace);
    let lastIndex = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].matchId === matchId) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return null;
    const [removed] = items.splice(lastIndex, 1);
    await writeAll(namespace, items);
    notify(namespace);
    return removed;
  });
}

// Live (re-renders on every enqueue/dequeue) count of a match's not-yet-synced
// writes — this is what each sport's scoring screen uses for its "Offline —
// N pending, will sync when back online" banner.
export function usePendingCount(namespace: string, matchId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!matchId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      getQueueForMatch(namespace, matchId).then((items) => {
        if (!cancelled) setCount(items.length);
      });
    };
    refresh();
    const unsubscribe = subscribeQueue(namespace, refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [namespace, matchId]);

  return count;
}
