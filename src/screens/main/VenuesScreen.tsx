import { View, Text } from "react-native";

export default function VenuesScreen() {
  return (
    <View className="flex-1 bg-white px-6 pt-4">
      <Text className="text-2xl font-bold text-ink">Venues</Text>
      <Text className="text-muted mt-2">
        Venue search, filters and booking land here in Phases 4-5.
      </Text>
    </View>
  );
}
