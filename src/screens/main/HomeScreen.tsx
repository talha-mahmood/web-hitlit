import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-white px-6 pt-4">
      <Text className="text-2xl font-bold text-ink">Games near you</Text>
      <Text className="text-muted mt-2">
        Venue/court discovery lands here in Phase 4.
      </Text>
    </View>
  );
}
