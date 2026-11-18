import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

// Downloads a remote (Supabase Storage) image into the cache dir at its
// original, full-quality resolution, then opens the native share sheet so
// the user can save it to Photos/Files — same download-then-share pattern
// matchReport/pdfShare.ts and exportCsv.ts use for other file types.
export async function downloadAndShareImage(imageUrl: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing isn't available on this device.");
  }

  const extension = imageUrl.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
  const mimeType = MIME_BY_EXTENSION[extension] ?? "image/jpeg";
  const destination = new File(Paths.cache, `photo-${Date.now()}.${extension}`);

  const file = await File.downloadFileAsync(imageUrl, destination, { idempotent: true });

  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Save Photo" });
}
