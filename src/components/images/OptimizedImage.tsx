import { Image as ExpoImage, type ImageProps as ExpoImageProps } from "expo-image";
import { type ImageProps as NativeImageProps, type ImageSourcePropType } from "react-native";
import { cssInterop } from "nativewind";
import { getOptimizedImageUrl, type ImageFit } from "../../services/images/imageUrls";
import type { ImageSizeVariant } from "../../constants/imageSizes";

// Expo Image is not a core React Native component, so NativeWind needs an
// explicit mapping for className-based sizing and layout styles.
cssInterop(ExpoImage, { className: "style" });

type ResizeMode = "cover" | "contain" | "stretch" | "center" | "repeat";

export type OptimizedImageProps = Omit<NativeImageProps, "source" | "resizeMode"> & {
  source?: ImageSourcePropType | null;
  resizeMode?: ResizeMode;
  contentFit?: ImageFit;
  variant?: ImageSizeVariant;
  className?: string;
  cachePolicy?: ExpoImageProps["cachePolicy"];
  transition?: ExpoImageProps["transition"];
};

function getFit(resizeMode?: ResizeMode, contentFit?: ImageFit): ImageFit | "none" {
  if (contentFit) return contentFit;
  if (resizeMode === "stretch") return "fill";
  if (resizeMode === "center" || resizeMode === "repeat") return "none";
  return resizeMode ?? "cover";
}

export default function OptimizedImage({
  source,
  resizeMode,
  contentFit,
  variant,
  style,
  cachePolicy,
  transition,
  ...props
}: OptimizedImageProps) {
  const fit = getFit(resizeMode, contentFit);
  const sourceUri = typeof source === "object" && source !== null && !Array.isArray(source) && "uri" in source
    ? source.uri
    : null;
  const optimizedUri = sourceUri
    ? getOptimizedImageUrl(sourceUri, { variant, fit: fit === "none" ? "contain" : fit })
    : null;
  const imageSource = optimizedUri && sourceUri
    ? { ...(source as { uri: string; headers?: Record<string, string> }), uri: optimizedUri }
    : source;
  const uri = optimizedUri ?? sourceUri;
  return (
    <ExpoImage
      {...(props as ExpoImageProps)}
      source={imageSource as ExpoImageProps["source"]}
      style={style}
      contentFit={fit}
      cachePolicy={cachePolicy ?? (uri ? "memory-disk" : "none")}
      transition={transition ?? (uri ? 120 : 0)}
      recyclingKey={uri ?? undefined}
    />
  );
}
