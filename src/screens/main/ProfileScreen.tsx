import { View, Text, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { colors } from "../../constants/theme";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white px-6" style={{ paddingTop: insets.top + 16 }}>
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

      {/* My Bookings */}
      <Pressable
        onPress={() => navigation.navigate("MyBookings")}
        className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3 mb-3"
      >
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Ionicons name="calendar-outline" size={20} color={colors.ink} />
          <Text className="text-ink font-medium">My Bookings</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
      <Pressable
        onPress={async () => { await signOutGoogle(); supabase.auth.signOut(); }}
        className="bg-primary rounded-xl py-3 items-center"
      >
        <Text className="text-white font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
