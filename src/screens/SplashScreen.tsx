import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "../constants/theme";

export default function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold text-primary mb-4">PlayPals</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
