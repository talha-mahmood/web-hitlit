import { View, Text } from "react-native";

export default function GamesScreen() {
  return (
    <View className="flex-1 bg-app px-6 pt-4">
      <Text className="text-2xl font-bold text-ink">Games</Text>
      <Text className="text-muted mt-2">
        Browse/join/create games lands here in Phase 6.
      </Text>
    </View>
  );
}
