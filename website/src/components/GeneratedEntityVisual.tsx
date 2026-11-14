import { useMemo, useState, type CSSProperties } from "react";
import { generateVisualAsset, type VisualAssetInput } from "@app/services/assets/assetGenerator";

type Props = VisualAssetInput & {
  imageUrl?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

// Port of GeneratedEntityVisual: the saved custom/generated image when there
// is one, otherwise the same deterministic local SVG badge the app draws.
export default function GeneratedEntityVisual({ imageUrl, size = 48, className, style, ...asset }: Props) {
  const fallback = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(generateVisualAsset(asset))}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asset.id, asset.kind, asset.name, asset.seed, asset.sport]
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = imageUrl && failedUrl !== imageUrl ? imageUrl : fallback;
  return (
    <span className={`inline-block shrink-0 overflow-hidden ${className ?? ""}`} style={{ width: size, height: size, borderRadius: size * 0.2, ...style }}>
      <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => imageUrl && setFailedUrl(imageUrl)} />
    </span>
  );
}
