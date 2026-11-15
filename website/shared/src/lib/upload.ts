import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { uploadOptimizedImage } from "../services/images/imageUpload";

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
    // Keep the selected source intact here; uploadImage performs one
    // category-aware resize/compression pass before it reaches Storage.
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets;
}

export async function uploadImage(
  asset: ImagePicker.ImagePickerAsset,
  opts: { bucket: string; pathPrefix: string }
): Promise<{ publicUrl: string; path: string }> {
  const uploaded = await uploadOptimizedImage({
    uri: asset.uri,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    bucket: opts.bucket,
    folder: opts.pathPrefix,
  });
  return { publicUrl: uploaded.publicUrl, path: uploaded.path };
}
