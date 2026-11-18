import { Image as ExpoImage } from "expo-image";
import { getOptimizedImageUrl, type ImageFit } from "./imageUrls";
import type { ImageSizeVariant } from "../../constants/imageSizes";

export type ImagePrefetchItem = {
  url: string | null | undefined;
  variant?: ImageSizeVariant;
  fit?: ImageFit;
};

export async function prefetchImages(items: ImagePrefetchItem[], batchSize = 6) {
  const urls = [...new Set(items
    .map((item) => getOptimizedImageUrl(item.url, { variant: item.variant, fit: item.fit }))
    .filter((url): url is string => Boolean(url)))];

  for (let index = 0; index < urls.length; index += batchSize) {
    await ExpoImage.prefetch(urls.slice(index, index + batchSize), { cachePolicy: "disk" });
  }
}
