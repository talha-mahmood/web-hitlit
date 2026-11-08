import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "../../lib/supabase";

type UploadImageOptions = {
  uri: string;
  mimeType?: string | null;
  width: number;
  height: number;
  bucket: string;
  folder: string;
};

function createImmutableFilename(extension: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}.${extension}`;
}

export async function uploadOptimizedImage({
  uri,
  mimeType: originalMimeType,
  width,
  height,
  bucket,
  folder,
}: UploadImageOptions) {
  const maxWidth = bucket === "avatars" ? 512 : 1600;
  const mimeType = originalMimeType?.toLowerCase() ?? "image/jpeg";
  const format = mimeType === "image/png"
    ? SaveFormat.PNG
    : mimeType === "image/webp"
      ? SaveFormat.WEBP
      : SaveFormat.JPEG;
  const extension = format === SaveFormat.PNG ? "png" : format === SaveFormat.WEBP ? "webp" : "jpg";
  const contentType = format === SaveFormat.PNG ? "image/png" : format === SaveFormat.WEBP ? "image/webp" : "image/jpeg";

  const context = ImageManipulator.manipulate(uri);
  const scale = Math.min(1, maxWidth / Math.max(width, height));
  if (scale < 1) context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  const rendered = await context.renderAsync();
  const compressed = await rendered.saveAsync({
    format,
    // PNG stays lossless so transparent logos retain their alpha channel.
    compress: format === SaveFormat.PNG ? 1 : 0.82,
  });

  const path = `${folder}/${createImmutableFilename(extension)}`;
  const response = await fetch(compressed.uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    width: compressed.width,
    height: compressed.height,
    size: arrayBuffer.byteLength,
  };
}
