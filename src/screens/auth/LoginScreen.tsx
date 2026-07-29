import { View, Text } from "react-native";

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-ink mb-2">Welcome</Text>
      <Text className="text-muted text-center">
        Auth screens (phone OTP, email, Google) land here in Phase 3.
      </Text>
    </View>
  );
}
