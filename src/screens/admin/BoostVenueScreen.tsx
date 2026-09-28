import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail } from "../../hooks/useVenuesAdmin";
import { isVenueBoosted } from "../../lib/api/venues";
import { colors, cardShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";

type Route = RouteProp<VenueEditingParamList, "BoostVenue">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "BoostVenue">;

const TIERS = [
  { days: 7, price: 1500, label: "1 Week" },
  { days: 30, price: 4500, label: "1 Month", best: true },
  { days: 90, price: 10000, label: "3 Months" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
}

export default function BoostVenueScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);

  const boosted = venue ? isVenueBoosted(venue) : false;

  const handlePay = () => {
    Alert.alert(
      "Coming Soon",
      "Online payments for boosting aren't live yet. To boost this venue right now, contact HitLit support and they'll activate it for you."
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          Boost · {params.venueName}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View
            className="rounded-2xl p-5 mb-5"
            style={{ backgroundColor: "#111827" }}
          >
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <Ionicons name="rocket" size={20} color="#F59E0B" />
              <Text className="text-white font-extrabold text-lg">Boost Your Venue</Text>
            </View>
            <Text className="text-gray-300 text-sm leading-5">
              A boosted venue is pinned to the top of search &amp; "near you" results in its
              area, so players see it first — more visibility, more bookings.
            </Text>
          </View>

          {venue && boosted && venue.boosted_until ? (
            <View
              className="flex-row items-center rounded-2xl p-4 mb-5 bg-white"
              style={{ ...cardShadow, gap: 10 }}
            >
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <View className="flex-1">
                <Text className="text-ink font-semibold text-sm">Boost is active</Text>
                <Text className="text-muted text-xs mt-0.5">
                  This venue is pinned to the top until {formatDate(venue.boosted_until)}.
                </Text>
              </View>
            </View>
          ) : (
            <View
              className="flex-row items-center rounded-2xl p-4 mb-5 bg-white"
              style={{ ...cardShadow, gap: 10 }}
            >
              <Ionicons name="information-circle-outline" size={22} color={colors.muted} />
              <Text className="text-muted text-sm flex-1">This venue isn't boosted right now.</Text>
            </View>
          )}

          <Text className="text-ink font-bold text-base mb-3">Choose a plan</Text>

          {TIERS.map((tier) => (
            <View
              key={tier.days}
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between"
              style={{
                ...cardShadow,
                borderWidth: tier.best ? 1.5 : 0,
                borderColor: tier.best ? colors.primary : "transparent",
              }}
            >
              <View className="flex-1">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-ink font-bold text-base">{tier.label}</Text>
                  {tier.best && (
                    <View className="bg-primary-light rounded-full px-2 py-0.5">
                      <Text className="text-primary text-[10px] font-bold">BEST VALUE</Text>
                    </View>
                  )}
                </View>
                <Text className="text-muted text-xs mt-1">{tier.days} days at the top</Text>
              </View>
              <View className="items-end">
                <Text className="text-ink font-extrabold text-lg mb-2">
                  Rs {tier.price.toLocaleString("en-PK")}
                </Text>
                <Pressable
                  onPress={handlePay}
                  className="bg-gray-200 rounded-xl px-4 py-2"
                >
                  <Text className="text-muted font-semibold text-xs">Pay &amp; Boost</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text className="text-muted text-xs text-center mt-2">
            Online payments are coming soon — pricing shown here is indicative.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
