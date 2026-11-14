import { supabase } from "./supabase";

// Web version of src/lib/upload.ts. `pickImages` opens the browser's file
// chooser and returns assets in the same shape expo-image-picker does
// (uri/mimeType), plus the underlying File so the upload never needs a
// round trip through the blob URL.
export type WebImageAsset = {
  uri: string;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
  file: File;
};

export function pickImages(opts: {
  allowsMultipleSelection?: boolean;
  aspect?: [number, number];
  allowsEditing?: boolean;
}): Promise<WebImageAsset[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = opts.allowsMultipleSelection ?? false;
    input.style.display = "none";
    let settled = false;
    const finish = (assets: WebImageAsset[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(assets);
    };
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith("image/"));
      finish(
        files.map((file) => ({
          uri: URL.createObjectURL(file),
          mimeType: file.type || "image/jpeg",
          fileName: file.name,
          file,
        }))
      );
    });
    input.addEventListener("cancel", () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

export async function uploadImage(
  asset: { uri: string; mimeType?: string | null; fileName?: string | null; file?: File },
  opts: { bucket: string; pathPrefix: string }
): Promise<{ publicUrl: string; path: string }> {
  const nameSource = asset.fileName ?? asset.uri;
  const extension = nameSource.includes(".") ? nameSource.split(".").pop()!.toLowerCase() : "jpg";
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${opts.pathPrefix}/${Date.now()}-${random}.${extension}`;

  const body: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());

  const { error } = await supabase.storage.from(opts.bucket).upload(path, body, {
    contentType: asset.mimeType ?? "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(opts.bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
