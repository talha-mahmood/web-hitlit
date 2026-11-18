import { downloadBlob } from "@/lib/download";

// Web version: downloads the full-quality original instead of opening the
// share sheet. Falls back to opening it in a new tab if the storage host
// doesn't allow a cross-origin fetch.
export async function downloadAndShareImage(imageUrl: string): Promise<void> {
  const extension = imageUrl.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    downloadBlob(await res.blob(), `photo-${Date.now()}.${extension}`);
  } catch {
    window.open(imageUrl, "_blank", "noopener");
  }
}
