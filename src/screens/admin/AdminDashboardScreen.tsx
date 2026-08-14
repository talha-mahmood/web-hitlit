import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useAdminVenueDetail, useVenueBookings } from "../../hooks/useVenuesAdmin";
import { toLocalDateStr } from "../../lib/slots";
import { colors } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "AdminDashboard">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AdminDashboard">;

const CARD_BORDER = {
  borderWidth: 1,
  borderColor: "rgba(17, 24, 39, 0.06)",
} as const;

function QuickLinkCard({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="bg-white rounded-2xl p-4" style={{ width: "48%", ...CARD_BORDER }}>
      <View
        className="items-center justify-center rounded-full mb-3"
        style={{ width: 40, height: 40, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <Text className="text-ink font-semibold text-sm">{label}</Text>
    </Pressable>
  );
}

export default function AdminDashboardScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const { data: bookings } = useVenueBookings(params.venueId);

  const today = toLocalDateStr(new Date());
  const todaysBookings = (bookings ?? []).filter((b) => toLocalDateStr(new Date(b.start_time)) === today);
  const courtsCount = venue?.court.length ?? 0;

  if (isLoading || !venue) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}>
      <View className="px-6">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-bold text-ink flex-1" numberOfLines={1}>
            {venue.name}
          </Text>
          {!venue.isactive && (
            <View className="bg-gray-100 px-2.5 py-1 rounded-full ml-2">
              <Text className="text-muted text-xs font-semibold">Closed</Text>
            </View>
          )}
        </View>
        <Text className="text-muted text-sm mb-6">{venue.city ?? "City not set"}</Text>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1 bg-white rounded-2xl p-4 items-center" style={CARD_BORDER}>
            <Text className="text-ink font-extrabold text-2xl">{todaysBookings.length}</Text>
            <Text className="text-muted text-xs mt-0.5">Today's Bookings</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 items-center" style={CARD_BORDER}>
            <Text className="text-ink font-extrabold text-2xl">{courtsCount}</Text>
            <Text className="text-muted text-xs mt-0.5">Courts</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 items-center" style={CARD_BORDER}>
            <Text className="text-ink font-extrabold text-2xl">{venue.rating.toFixed(1)}</Text>
            <Text className="text-muted text-xs mt-0.5">Rating</Text>
          </View>
        </View>

        <Text className="text-lg font-semibold text-ink mt-6 mb-3">Manage Venue</Text>
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
          <QuickLinkCard
            icon="create-outline"
            label="Venue Details"
            onPress={() => navigation.navigate("EditVenueDetails", { venueId: params.venueId })}
          />
          <QuickLinkCard
            icon="images-outline"
            label="Photos"
            onPress={() => navigation.navigate("ManageVenueImages", { venueId: params.venueId })}
          />
          <QuickLinkCard
            icon="grid-outline"
            label="Courts & Slots"
            onPress={() => navigation.navigate("ManageCourts", { venueId: params.venueId })}
          />
          <QuickLinkCard
            icon="sparkles-outline"
            label="Amenities"
            onPress={() => navigation.navigate("ManageFacilities", { venueId: params.venueId })}
          />
          <QuickLinkCard
            icon="calendar-outline"
            label="Bookings"
            onPress={() => navigation.navigate("VenueBookings", { venueId: params.venueId })}
          />
        </View>

        <Pressable
          onPress={async () => {
            await signOutGoogle();
            supabase.auth.signOut();
          }}
          className="border border-danger rounded-xl py-3 items-center mt-8"
        >
          <Text className="text-danger font-semibold">Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
