// AsyncStorage's API on top of localStorage. Every call is wrapped so a
// private window / blocked storage behaves like an empty store rather than
// throwing — same "best effort" contract the app's callers already assume.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return safe(() => window.localStorage.getItem(key), null);
  },
  async setItem(key: string, value: string): Promise<void> {
    safe(() => window.localStorage.setItem(key, value), undefined);
  },
  async removeItem(key: string): Promise<void> {
    safe(() => window.localStorage.removeItem(key), undefined);
  },
  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach((k) => safe(() => window.localStorage.removeItem(k), undefined));
  },
  async getAllKeys(): Promise<string[]> {
    return safe(() => Object.keys(window.localStorage), []);
  },
  async clear(): Promise<void> {
    safe(() => window.localStorage.clear(), undefined);
  },
};

export default AsyncStorage;
