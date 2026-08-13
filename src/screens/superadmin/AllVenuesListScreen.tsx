import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAllVenues } from "../../hooks/useSuperadmin";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AllVenuesList">;

export default function AllVenuesListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: venues, isLoading } = useAllVenues(search || undefined);

  return (
    <View className="flex-1 bg-white">
      <View className="px-5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-ink">All Venues</Text>
          <Pressable
            onPress={() => navigation.navigate("CreateVenue")}
            className="flex-row items-center bg-primary rounded-lg px-3 py-2"
            style={{ gap: 4 }}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text className="text-white text-xs font-semibold">New Venue</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center border border-border rounded-xl px-4" style={{ gap: 8 }}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search venues"
            className="flex-1 py-3 text-ink"
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={venues ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="business-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No venues found.</Text>
            </View>
          }
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("AdminDashboard", { venueId: item.id })}
              className="flex-row items-center border border-border rounded-2xl p-4"
            >
              <View className="flex-1 mr-3">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!item.isactive && (
                    <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                      <Text className="text-muted text-xs font-medium">Closed</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                  {item.city ?? "City not set"}
                </Text>
                <Text className="text-xs mt-1" style={{ color: item.profiles ? colors.primaryDark : colors.warning }}>
                  {item.profiles ? `Admin: ${item.profiles.full_name ?? item.profiles.email}` : "No admin assigned"}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  navigation.navigate("AssignAdmin", {
                    venueId: item.id,
                    venueName: item.name,
                    currentAdminEmail: item.profiles?.email ?? null,
                  })
                }
                hitSlop={8}
                className="mr-2"
              >
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
              </Pressable>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
