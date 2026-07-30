import { View, Text, Pressable, Image } from "react-native";
import { supabase } from "../../lib/supabase";
import { useProfileStore } from "../../store/profileStore";

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);

  return (
    <View className="flex-1 bg-white px-6 pt-4">
      <View className="flex-row items-center mb-6">
        {profile?.avatar ? (
          <Image source={{ uri: profile.avatar }} className="w-14 h-14 rounded-full bg-primary-light mr-4" />
        ) : (
          <View className="w-14 h-14 rounded-full bg-primary-light items-center justify-center mr-4">
            <Text className="text-xl font-bold text-primary">
              {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <View>
          <Text className="text-2xl font-bold text-ink">{profile?.full_name ?? "Profile"}</Text>
          <Text className="text-muted">{profile?.email}</Text>
        </View>
      </View>
      <Text className="text-muted mb-6">
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
