import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAllVenues, useDeleteVenue } from "../../hooks/useSuperadmin";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";
import SearchField from "../../components/SearchField";
import GradientFill from "../../components/GradientFill";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AllVenuesList">;

export default function AllVenuesListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: venues, isLoading, refetch, isRefetching } = useAllVenues(search || undefined);
  const deleteVenue = useDeleteVenue();

  const handleDelete = (venueId: string, venueName: string) => {
    Alert.alert(
      "Delete Venue",
      `Delete "${venueName}"? It'll be hidden from customers and its admin immediately — this can only be undone from the database.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteVenue.mutate(venueId, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete venue.")),
            }),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-3.5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-ink">All Venues</Text>
          <Pressable
            onPress={() => navigation.navigate("CreateVenue")}
            style={primaryButtonShadow}
          >
            <GradientFill className="flex-row items-center rounded-lg px-3 py-2" style={{ gap: 4 }}>
              <Ionicons name="add" size={16} color="white" />
              <Text className="text-white text-xs font-semibold">New Venue</Text>
            </GradientFill>
          </Pressable>
        </View>
        <SearchField value={search} onChangeText={setSearch} prefix="Search by " variants={["venue name"]} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={venues ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
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
                signOutWithPushCleanup();
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
              <Pressable onPress={() => handleDelete(item.id, item.name)} hitSlop={8} className="mr-2">
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
