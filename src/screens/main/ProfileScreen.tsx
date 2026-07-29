import { View, Text, Pressable } from "react-native";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-white px-6 pt-4">
      <Text className="text-2xl font-bold text-ink">Profile</Text>
      <Text className="text-muted mt-2 mb-6">
        Full profile/stats UI lands here in Phase 7.
      </Text>
      <Pressable
        onPress={() => supabase.auth.signOut()}
        className="bg-primary rounded-xl py-3 items-center"
      >
        <Text className="text-white font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
