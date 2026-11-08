import { Image as ExpoImage } from "expo-image";

export async function clearImageCache() {
  await Promise.all([ExpoImage.clearMemoryCache(), ExpoImage.clearDiskCache()]);
}
