export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// The app passes images around as RN sources: a remote `{ uri }`, a bundled
// asset, or nothing. On the web every one of those is just a URL string.
export function imageUrl(source: unknown): string | undefined {
  if (!source) return undefined;
  if (typeof source === "string") return source;
  if (typeof source === "object" && "uri" in source && typeof (source as { uri: unknown }).uri === "string") {
    return (source as { uri: string }).uri;
  }
  return undefined;
}
