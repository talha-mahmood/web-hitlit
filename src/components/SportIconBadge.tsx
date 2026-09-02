import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";

export default function SportIconBadge({
  sportName,
  size = 34,
}: {
  sportName: string | undefined;
  size?: number;
}) {
  const { icon, bg, fg } = getSportIcon(sportName ?? "");
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.55} color={fg} />
    </View>
  );
}
