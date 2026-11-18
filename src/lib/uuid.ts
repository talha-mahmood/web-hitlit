// A plain, dependency-free UUID v4 generator — not cryptographically
// secure, but this is only ever used as a client-generated row id for
// offline-created rows (e.g. a cricket innings started while offline), so
// collision resistance from Math.random() is more than sufficient. Avoids
// pulling in react-native-get-random-values + crypto.randomUUID() just for
// this, which would be another native dependency requiring a rebuild.
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
