import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useDeleteCourt } from "../../hooks/useVenuesAdmin";
import { colors, primaryButtonShadow } from "../../constants/theme";
import SportIconBadge from "../../components/SportIconBadge";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<VenueEditingParamList, "ManageCourts">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "ManageCourts">;

export default function ManageCourtsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const deleteCourt = useDeleteCourt(params.venueId);

  const courts = venue?.court ?? [];

  const handleDeactivate = (courtId: string, name: string) => {
    Alert.alert("Deactivate Court", `Deactivate "${name}"? It'll be hidden from bookings and slot management.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: () =>
          deleteCourt.mutate(courtId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not deactivate court.")),
          }),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Courts</Text>
        <Pressable
          onPress={() => navigation.navigate("EditCourt", { venueId: params.venueId })}
          className="flex-row items-center bg-primary rounded-lg px-3 py-1.5"
          style={{ gap: 4, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={14} color="white" />
          <Text className="text-white text-xs font-semibold">Add</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}>
        {courts.length === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-8 items-center">
            <Ionicons name="grid-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              No courts yet. Add one so players can book a time slot.
            </Text>
          </View>
        ) : (
          courts.map((court) => (
            <Pressable
              key={court.id}
              onPress={() => navigation.navigate("EditCourt", { venueId: params.venueId, courtId: court.id })}
              className="border border-border rounded-2xl p-4 flex-row items-center justify-between"
            >
              <SportIconBadge sportName={court.sports?.name} size={36} />
              <View className="flex-1 mx-3">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-ink font-bold text-sm">{court.name}</Text>
                  {!court.isactive && (
                    <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                      <Text className="text-muted text-xs font-medium">Inactive</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted text-xs mt-0.5">
                  {court.sports?.name ?? "Sport not set"} · Rs {court.price_per_hour.toLocaleString()}/hr
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  navigation.navigate("ManageCourtImages", { venueId: params.venueId, courtId: court.id, courtName: court.name })
                }
                hitSlop={8}
                className="mr-3"
              >
                <Ionicons name="images-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() =>
                  navigation.navigate("AdminSlots", { venueId: params.venueId, courtId: court.id, courtName: court.name })
                }
                hitSlop={8}
                className="mr-3"
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => handleDeactivate(court.id, court.name)} hitSlop={8} className="mr-1">
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
