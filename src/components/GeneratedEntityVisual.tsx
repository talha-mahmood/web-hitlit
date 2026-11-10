import { useEffect, useMemo, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SvgUri, SvgXml } from "react-native-svg";
import OptimizedImage from "./images/OptimizedImage";
import { generateVisualAsset, type VisualAssetInput } from "../services/assets/assetGenerator";

type Props = VisualAssetInput & {
  imageUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

function isSvgUrl(url: string): boolean {
  return /\.svg(?:[?#]|$)/i.test(url);
}

/** Uses a saved custom/generated image when present; otherwise renders the stable local SVG fallback. */
export default function GeneratedEntityVisual({ imageUrl, size = 48, style, ...asset }: Props) {
  const xml = useMemo(() => generateVisualAsset(asset), [asset.id, asset.kind, asset.name, asset.seed, asset.sport]);
  const [remoteSvgFailed, setRemoteSvgFailed] = useState(false);

  useEffect(() => setRemoteSvgFailed(false), [imageUrl]);

  return (
    <View style={[{ width: size, height: size, overflow: "hidden", borderRadius: size * 0.2 }, style]}>
      {imageUrl && isSvgUrl(imageUrl) && !remoteSvgFailed ? (
        <SvgUri
          uri={imageUrl}
          width={size}
          height={size}
          fallback={<SvgXml xml={xml} width={size} height={size} />}
          onError={() => setRemoteSvgFailed(true)}
        />
      ) : imageUrl ? (
        <OptimizedImage source={{ uri: imageUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <SvgXml xml={xml} width={size} height={size} />
      )}
    </View>
  );
}
