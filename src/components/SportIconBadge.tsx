import { View, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";

export default function SportIconBadge({
  sportName,
  size = 34,
}: {
  sportName: string | undefined;
  size?: number;
}) {
  const photo = getSportImage(sportName ?? "");
  const { icon, bg, fg } = getSportIcon(sportName ?? "");

  if (photo) {
    return (
      <Image
        source={photo}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.55} color={fg} />
    </View>
  );
}
