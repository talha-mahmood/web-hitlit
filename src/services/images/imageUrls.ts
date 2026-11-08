import { IMAGE_SIZES, type ImageSizeVariant } from "../../constants/imageSizes";
import { supabase } from "../../lib/supabase";

export type ImageFit = "cover" | "contain" | "fill";

// Storage image transformations are disabled unless the Supabase project is
// entitled to use them. Direct public URLs remain the safe default.
export const SUPABASE_IMAGE_TRANSFORMS_ENABLED =
  process.env.EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORMS === "true";

function inferVariant(url: string): ImageSizeVariant {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
  const bucket = match?.[1]?.toLowerCase() ?? "";
  if (bucket === "avatars") return IMAGE_SIZES.avatar.medium;
  if (bucket === "venue-images" || bucket === "court-images") return IMAGE_SIZES.venue.card;
  if (bucket === "event-icons") return IMAGE_SIZES.event.card;
  if (bucket === "game-icons") return IMAGE_SIZES.game.card;
  if (bucket === "squad-icons") return IMAGE_SIZES.group.card;
  return IMAGE_SIZES.game.card;
}

export function getOptimizedImageUrl(
  imageUrl: string | null | undefined,
  options: { variant?: ImageSizeVariant; fit?: ImageFit } = {}
): string | null {
  if (!imageUrl) return null;
  if (!SUPABASE_IMAGE_TRANSFORMS_ENABLED) return imageUrl;

  // Only transform public Storage object URLs. Signed URLs, arbitrary URLs,
  // and URLs with existing query parameters are passed through unchanged.
  const match = imageUrl.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match || imageUrl.includes("?")) return imageUrl;

  const [, , bucket, encodedPath] = match;
  let path: string;
  try {
    path = encodedPath.split("/").map(decodeURIComponent).join("/");
  } catch {
    return imageUrl;
  }

  const variant = options.variant ?? inferVariant(imageUrl);
  const { data } = supabase.storage.from(decodeURIComponent(bucket)).getPublicUrl(path, {
    transform: {
      width: variant.width,
      height: variant.height,
      quality: variant.quality,
      resize: options.fit ?? "cover",
    },
  });
  return data.publicUrl;
}
