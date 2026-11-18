import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import OptimizedImage from "./OptimizedImage";

export default function OptimizedAvatar({ uri, size = 48 }: { uri?: string | null; size?: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-primary-light"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      {uri ? (
        <OptimizedImage source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.55)} color={colors.primaryDark} />
      )}
    </View>
  );
}
