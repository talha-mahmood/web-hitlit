import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { supabase } from "./supabase";

// Generalizes the single-avatar-upload flow used elsewhere (e.g. Profile's
// own avatar picker) for multi-image, non-square uploads (venue/court photos).

export async function pickImages(opts: {
  allowsMultipleSelection?: boolean;
  aspect?: [number, number];
  allowsEditing?: boolean;
}): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission needed", "Allow photo library access to upload images.");
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: opts.allowsEditing ?? false,
    aspect: opts.aspect,
    allowsMultipleSelection: opts.allowsMultipleSelection ?? false,
    quality: 0.7,
  });
  if (result.canceled) return [];
  return result.assets;
}

export async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  opts: { bucket: string; pathPrefix: string }
): Promise<{ publicUrl: string; path: string }> {
  const extension = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${opts.pathPrefix}/${Date.now()}-${random}.${extension}`;

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from(opts.bucket).upload(path, arrayBuffer, {
    contentType: asset.mimeType ?? "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(opts.bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
