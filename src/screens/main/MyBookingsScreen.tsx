import { useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMyBookings } from "../../hooks/useBookings";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, cardShadow } from "../../constants/theme";
import type { BookingWithCourt } from "../../lib/api/bookings";

function formatBookingDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-PK", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBookingTime(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  const start = new Date(startIso).toLocaleTimeString("en-PK", opts);
  const end = new Date(endIso).toLocaleTimeString("en-PK", opts);
  return `${start} – ${end}`;
}

function StatusBadge({ status }: { status: BookingWithCourt["status"] }) {
  const bg =
    status === "CONFIRMED" ? colors.primaryLight :
    status === "PENDING"   ? "#FEF9C3" :
    status === "CANCELLED" ? "#FEE2E2" :
    status === "COMPLETED" ? "#DBEAFE" : "#F3F4F6";
  const fg =
    status === "CONFIRMED" ? colors.primaryDark :
    status === "PENDING"   ? "#A16207" :
    status === "CANCELLED" ? colors.danger :
    status === "COMPLETED" ? "#1D4ED8" : colors.muted;
  const icon =
    status === "CONFIRMED" ? "checkmark-circle" :
    status === "PENDING"   ? "hourglass" :
    status === "CANCELLED" ? "close-circle" :
    status === "COMPLETED" ? "checkmark-done-circle" : "time-outline";
  const label =
    status === "CONFIRMED" ? "Confirmed" :
    status === "PENDING"   ? "Pending" :
    status === "CANCELLED" ? "Cancelled" :
    status === "COMPLETED" ? "Completed" : "Expired";

  return (
    <View className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: bg, gap: 4 }}>
      <Ionicons name={icon as React.ComponentProps<typeof Ionicons>["name"]} size={12} color={fg} />
      <Text className="text-xs font-bold" style={{ color: fg }}>{label}</Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: BookingWithCourt }) {
  const sportName = booking.court?.sports?.name ?? "";
  const photo = getSportImage(sportName);
  const { icon: watermarkIcon } = getSportIcon(sportName);

  return (
    <View className="rounded-2xl bg-white mb-3 overflow-hidden" style={{ ...cardShadow, position: "relative" }}>
      <MaterialCommunityIcons
        name={watermarkIcon}
        size={90}
        color={colors.primary}
        style={{ position: "absolute", right: -14, bottom: -14, opacity: 0.08 }}
      />
      <View className="flex-row p-3">
        {photo ? (
          <Image source={photo} style={{ width: 84, height: 108, borderRadius: 14 }} resizeMode="cover" />
        ) : (
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: 84, height: 108, backgroundColor: colors.primaryLight }}
          >
            <MaterialCommunityIcons name={watermarkIcon} size={32} color={colors.primaryDark} />
          </View>
        )}

        <View className="flex-1 ml-3">
          <View className="flex-row items-start justify-between">
            <Text className="text-ink font-bold text-base flex-1 mr-2" numberOfLines={1}>
              {booking.court?.venues?.name ?? "—"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </View>
          <Text className="font-extrabold text-base" style={{ color: colors.primaryDark }}>
            Rs {booking.total_amount.toLocaleString()}
          </Text>
          <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
            <Ionicons name="location" size={12} color={colors.primaryDark} />
            <Text className="text-muted text-xs" numberOfLines={1}>
              {booking.court?.name}
              {booking.court?.venues?.city ? ` · ${booking.court.venues.city}` : ""}
            </Text>
          </View>

          <View
            className="flex-row items-center rounded-lg px-2.5 py-2 mt-2"
            style={{ backgroundColor: colors.primaryLight, gap: 10 }}
          >
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="calendar-outline" size={13} color={colors.primaryDark} />
              <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                {formatBookingDate(booking.start_time)}
              </Text>
            </View>
            <View style={{ width: 1, height: 12, backgroundColor: "rgba(0,0,0,0.12)" }} />
            <View className="flex-row items-center flex-1" style={{ gap: 4 }}>
              <Ionicons name="time-outline" size={13} color={colors.primaryDark} />
              <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }} numberOfLines={1}>
                {formatBookingTime(booking.start_time, booking.end_time)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
            <StatusBadge status={booking.status} />
            {booking.payment_status === "unpaid" &&
              (booking.status === "CONFIRMED" || booking.status === "PENDING") && (
                <View
                  className="flex-row items-center rounded-full px-2.5 py-1"
                  style={{ backgroundColor: "#FEF3C7", gap: 4 }}
                >
                  <Ionicons name="card-outline" size={12} color="#B45309" />
                  <Text className="text-xs font-bold" style={{ color: "#B45309" }}>
                    Pay at venue
                  </Text>
                </View>
              )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MyBookingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: bookings = [], isLoading, refetch, isRefetching } = useMyBookings();

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => new Date(b.start_time) > now && b.status !== "CANCELLED" && b.status !== "EXPIRED"
  );
  const past = bookings.filter(
    (b) => new Date(b.start_time) <= now || b.status === "CANCELLED" || b.status === "EXPIRED"
  );
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <View className="flex-1 bg-white">
      {/* Hero header */}
      <View
        style={{ backgroundColor: colors.primaryLight, paddingTop: insets.top + 16, paddingBottom: 20, overflow: "hidden", position: "relative" }}
      >
        <MaterialCommunityIcons
          name="stadium-variant"
          size={150}
          color={colors.primaryDark}
          style={{ position: "absolute", right: -20, top: -10, opacity: 0.16 }}
        />
        <View className="px-4 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="items-center justify-center rounded-full bg-white mr-3"
            style={{ width: 40, height: 40, ...cardShadow }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink font-extrabold" style={{ fontSize: 22 }} numberOfLines={1}>
              My Bookings
            </Text>
            <Text className="text-muted text-sm mt-0.5">Manage and view all your bookings</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="mx-4 mt-4 mb-3 flex-row" style={{ gap: 10 }}>
        {(["upcoming", "past"] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className="flex-1 flex-row items-center justify-center rounded-full py-3"
              style={{
                gap: 6,
                backgroundColor: active ? colors.primary : "white",
                borderWidth: active ? 0 : 1,
                borderColor: colors.border,
                ...(active ? cardShadow : null),
              }}
            >
              <Ionicons
                name={t === "upcoming" ? "calendar-outline" : "time-outline"}
                size={16}
                color={active ? "white" : colors.muted}
              />
              <Text className={`font-bold text-sm ${active ? "text-white" : "text-muted"}`}>
                {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Ionicons name="calendar-outline" size={52} color={colors.border} />
              <Text className="text-ink font-semibold text-base mt-4">
                No {tab} bookings
              </Text>
              <Text className="text-muted text-sm text-center mt-1 px-8">
                {tab === "upcoming"
                  ? "Book a court from the Venues tab."
                  : "Your completed and cancelled bookings will appear here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => <BookingCard booking={item} />}
        />
      )}
    </View>
  );
}
