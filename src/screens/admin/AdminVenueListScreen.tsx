import { useEffect } from "react";
import { View, Text, Pressable, FlatList, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { useMyVenues } from "../../hooks/useVenuesAdmin";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Nav = NativeStackNavigationProp<VenueEditingParamList & { AdminVenueList: undefined }>;

export default function AdminVenueListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venues, isLoading } = useMyVenues(userId);

  useEffect(() => {
    if (venues && venues.length === 1) {
      navigation.replace("AdminDashboard", { venueId: venues[0].id });
    }
  }, [venues, navigation]);

  if (isLoading || (venues && venues.length === 1)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-6" style={{ paddingTop: insets.top + 16, paddingBottom: 16 }}>
        <Text className="text-2xl font-bold text-ink">Your Venues</Text>
      </View>

      <FlatList
        data={venues ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
        ListEmptyComponent={
          <View className="border border-dashed border-border rounded-2xl p-8 items-center">
            <Ionicons name="business-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              No venues assigned to you yet. Contact the app admin.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("AdminDashboard", { venueId: item.id })}
            className="flex-row items-center border border-border rounded-2xl p-3"
          >
            {item.venue_images[0] ? (
              <Image source={{ uri: item.venue_images[0].image_url }} className="w-14 h-14 rounded-xl bg-gray-100 mr-3" />
            ) : (
              <View className="w-14 h-14 rounded-xl bg-primary-light items-center justify-center mr-3">
                <Ionicons name="business-outline" size={22} color={colors.primary} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                {item.city ?? "City not set"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable
            onPress={async () => {
              await signOutGoogle();
              supabase.auth.signOut();
            }}
            className="border border-danger rounded-xl py-3 items-center mt-4"
          >
            <Text className="text-danger font-semibold">Sign out</Text>
          </Pressable>
        }
      />
    </View>
  );
}
