import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import {
  useAdminVenueDetail,
  useVenueBookings,
  useMyVenues,
  useAllMyVenuesBookings,
} from "../../hooks/useVenuesAdmin";
import {
  computeDashboardStats,
  computeRevenueByScale,
  computeUpcomingBookings,
  computeRecentActivity,
  computeTopVenues,
  type RevenueScale,
} from "../../lib/adminDashboard";
import { STATUS_BADGE } from "../../lib/bookingStatus";
import { colors, cardShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import AdminMenuOverlay from "../../components/AdminMenuOverlay";
import RevenueBarChart from "../../components/RevenueBarChart";
import GradientFill from "../../components/GradientFill";
import SportIconBadge from "../../components/SportIconBadge";
import { getSportIcon } from "../../lib/sportIcons";
import { getSportImage } from "../../lib/sportImages";
import { toLocalDateStr, generateFullDaySlots, slotBoundaryDateTime, type Slot } from "../../lib/slots";
import type { VenueBooking } from "../../lib/api/venuesAdmin";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type Route = RouteProp<VenueEditingParamList, "AdminDashboard">;
type Nav = NativeStackNavigationProp<VenueEditingParamList & { AdminVenueList: undefined }>;

const CARD_BORDER = { borderWidth: 1, borderColor: "rgba(17, 24, 39, 0.06)" } as const;

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function DeltaLabel({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <View className="flex-row items-center mt-1" style={{ gap: 2 }}>
      <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? colors.primary : colors.danger} />
      <Text className="text-[11px]" style={{ color: up ? colors.primary : colors.danger }}>
        {Math.abs(value)}
        {suffix} vs yesterday
      </Text>
    </View>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  footer,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  delta?: number | null;
  footer?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="bg-white rounded-2xl p-4"
      style={{ width: "48%", ...CARD_BORDER }}
    >
      <View
        className="items-center justify-center rounded-full mb-3"
        style={{ width: 40, height: 40, backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-ink font-extrabold text-xl mt-0.5">{value}</Text>
      {delta !== undefined && <DeltaLabel value={delta} suffix="%" />}
      {footer && <Text className="text-primary text-xs font-semibold mt-1">{footer}</Text>}
    </Pressable>
  );
}

function SectionCard({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={CARD_BORDER}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-ink font-bold text-base">{title}</Text>
        {action && (
          <Pressable onPress={onAction} className="flex-row items-center" style={{ gap: 2 }}>
            <Text className="text-primary text-xs font-semibold">{action}</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const { data: bookings } = useVenueBookings(params.venueId);
  const { data: myVenues } = useMyVenues(userId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [hourlyModalOpen, setHourlyModalOpen] = useState(false);
  const [hourlyCourtId, setHourlyCourtId] = useState<string | null>(null);
  const [revenueScale, setRevenueScale] = useState<RevenueScale>("days");

  const venueIds = useMemo(() => (myVenues ?? []).map((v) => v.id), [myVenues]);
  const { data: allBookings } = useAllMyVenuesBookings(venueIds);

  const courtsCount = venue?.court.length ?? 0;
  const venueSports = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of venue?.court ?? []) {
      if (c.sports?.name) seen.set(c.sports_id, c.sports.name);
    }
    return Array.from(seen.values());
  }, [venue]);

  const stats = useMemo(
    () => (venue && bookings ? computeDashboardStats(bookings, venue, courtsCount) : null),
    [venue, bookings, courtsCount]
  );
  const weekly = useMemo(
    () => (bookings ? computeRevenueByScale(bookings, revenueScale) : null),
    [bookings, revenueScale]
  );
  const upcoming = useMemo(() => (bookings ? computeUpcomingBookings(bookings) : []), [bookings]);
  const recent = useMemo(() => (bookings ? computeRecentActivity(bookings) : []), [bookings]);
  const topVenues = useMemo(
    () => ((myVenues?.length ?? 0) > 1 ? computeTopVenues(myVenues!, allBookings) : []),
    [myVenues, allBookings]
  );

  if (isLoading || !venue || !stats || !weekly) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // Only the primary owner can grant/revoke additional admins (matches the
  // venue_admins RLS policies, which check is_venue_owner() specifically —
  // a secondary admin tapping this would just hit a permission error).
  const isPrimaryOwner = venue.venue_owner_id === userId;

  const menuItems = [
    { key: "dashboard", icon: "grid-outline" as const, label: "Dashboard", onPress: () => setMenuOpen(false) },
    {
      key: "editDetails",
      icon: "create-outline" as const,
      label: "Edit Venue Details",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("EditVenueDetails", { venueId: params.venueId });
      },
    },
    {
      key: "bookings",
      icon: "calendar-outline" as const,
      label: "Bookings",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("VenueBookings", { venueId: params.venueId });
      },
    },
    {
      key: "courts",
      icon: "grid-outline" as const,
      label: "Sports & Courts",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("ManageCourts", { venueId: params.venueId });
      },
    },
    {
      key: "venuePhotos",
      icon: "images-outline" as const,
      label: "Venue Photos",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("ManageVenueImages", { venueId: params.venueId });
      },
    },
    {
      key: "analytics",
      icon: "stats-chart-outline" as const,
      label: "AI Analytics",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("AdminAnalytics", { venueId: params.venueId });
      },
    },
    {
      key: "reviews",
      icon: "star-outline" as const,
      label: "Reviews",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("AdminReviews", { venueId: params.venueId });
      },
    },
    {
      key: "notifications",
      icon: "notifications-outline" as const,
      label: "Notifications",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("AdminNotifications");
      },
    },
    {
      key: "boost",
      icon: "rocket-outline" as const,
      label: "Boost Venue",
      onPress: () => {
        setMenuOpen(false);
        navigation.navigate("BoostVenue", { venueId: params.venueId, venueName: venue.name });
      },
    },
    ...(isPrimaryOwner
      ? [
          {
            key: "manageAdmins",
            icon: "people-outline" as const,
            label: "Manage Admins",
            onPress: () => {
              setMenuOpen(false);
              navigation.navigate("AssignAdmin", {
                venueId: params.venueId,
                venueName: venue.name,
                currentAdminEmail: profile?.email ?? null,
                hideOwnerTransfer: true,
              });
            },
          },
        ]
      : []),
    {
      key: "signout",
      icon: "log-out-outline" as const,
      label: "Sign Out",
      onPress: () => {
        setMenuOpen(false);
        Alert.alert("Sign Out", "Are you sure you want to sign out?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              await signOutGoogle();
              signOutWithPushCleanup();
            },
          },
        ]);
      },
    },
  ];

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#0B3B24", "#062A19"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 44,
            paddingHorizontal: 14,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View className="flex-row items-center justify-between mb-5">
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
              <Ionicons name="menu" size={26} color="white" />
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} className="w-10 h-10 rounded-full" />
              ) : (
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                  <Text className="text-white font-bold">{firstName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Text className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.65)", letterSpacing: 1 }}>
            {timeGreeting.toUpperCase()}
          </Text>
          <Text className="text-white text-2xl font-bold mt-1">{firstName} 👋</Text>

          {(myVenues?.length ?? 0) > 1 && (
            <Pressable
              onPress={() => setSwitcherOpen(true)}
              className="flex-row items-center self-start rounded-full px-3 py-2 mt-3"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Ionicons name="business" size={14} color="white" />
              <Text className="text-white text-sm font-semibold mx-2" numberOfLines={1}>
                {venue.name}
              </Text>
              <Ionicons name="chevron-down" size={14} color="white" />
            </Pressable>
          )}
        </LinearGradient>

        <View className="px-3.5" style={{ marginTop: -30 }}>
          <View className="bg-white rounded-2xl p-5 flex-row items-center justify-between mb-6" style={cardShadow}>
            <View className="flex-1 mr-3">
              <Text className="text-muted text-xs">Today's Revenue</Text>
              <Text className="text-ink font-extrabold text-2xl mt-1" numberOfLines={1}>
                Rs {stats.todaysRevenue.toLocaleString()}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate("VenueBookings", { venueId: params.venueId })}>
              <GradientFill className="flex-row items-center rounded-xl px-4 py-2.5" style={{ gap: 6 }}>
                <Ionicons name="calendar" size={14} color="white" />
                <Text className="text-white font-semibold text-sm">Bookings</Text>
              </GradientFill>
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.navigate("BoostVenue", { venueId: params.venueId, venueName: venue.name })}
            className="flex-row items-center justify-between mb-3"
            style={{ backgroundColor: "#111827", borderRadius: 16, padding: 16 }}
          >
            <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
              <Ionicons name="rocket" size={18} color="#F59E0B" />
              <Text className="text-white text-sm font-semibold flex-1" numberOfLines={2}>
                Boost Your Venue — get more bookings in your area
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="white" />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("ManageVenueImages", { venueId: params.venueId })}
            className="flex-row items-center justify-between mb-6 bg-white"
            style={{ borderRadius: 16, padding: 16, ...cardShadow }}
          >
            <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
              <Ionicons name="images" size={18} color={colors.primary} />
              <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={2}>
                Venue Photos — the first one shows on your listing card
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>

          {venueSports.length > 0 && (
            <View className="mb-6">
              <Text className="text-ink font-bold text-xs mb-3" style={{ letterSpacing: 1 }}>
                SPORTS &amp; COURTS
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
                {venueSports.map((sport) => {
                  const photo = getSportImage(sport);
                  const { icon, bg, fg } = getSportIcon(sport);
                  return (
                    <Pressable
                      key={sport}
                      onPress={() => navigation.navigate("ManageCourts", { venueId: params.venueId })}
                      className="items-center"
                      style={{ width: 64 }}
                    >
                      {photo ? (
                        <Image
                          source={photo}
                          style={{ width: 56, height: 56, borderRadius: 18 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 18,
                            backgroundColor: bg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialCommunityIcons name={icon} size={28} color={fg} />
                        </View>
                      )}
                      <Text className="text-ink text-xs font-medium mt-1.5 text-center" numberOfLines={1}>
                        {sport}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
            <StatCard
              icon="calendar"
              iconBg={colors.primaryLight}
              iconColor={colors.primaryDark}
              label="Today's Bookings"
              value={String(stats.todaysBookingsCount)}
              delta={stats.bookingsDelta}
            />
            <StatCard
              icon="wallet"
              iconBg="#EDE9FE"
              iconColor="#7C3AED"
              label="Today's Revenue"
              value={`Rs ${stats.todaysRevenue.toLocaleString()}`}
              delta={stats.revenueDelta}
            />
            <StatCard
              icon="pie-chart"
              iconBg="#DBEAFE"
              iconColor="#2563EB"
              label="Occupancy Rate"
              value={`${stats.occupancyRate}%`}
              delta={stats.occupancyDelta}
            />
            <StatCard
              icon="time"
              iconBg="#FFEDD5"
              iconColor="#EA580C"
              label="Pending Bookings"
              value={String(stats.pendingCount)}
            />
          </View>

          <View className="mt-4">
            <SectionCard
              title="Today's Schedule"
              action="View by Hour"
              onAction={() => {
                setHourlyCourtId(venue.court[0]?.id ?? null);
                setHourlyModalOpen(true);
              }}
            >
              {stats.todaysSchedule.length === 0 ? (
                <Text className="text-muted text-sm py-2">No bookings scheduled for today yet.</Text>
              ) : (
                stats.todaysSchedule.slice(0, 5).map((b) => {
                  const badge = STATUS_BADGE[b.status];
                  return (
                    <View key={b.id} className="flex-row items-center justify-between py-2 border-b border-border">
                      <View className="flex-row items-center flex-1 pr-2" style={{ gap: 10 }}>
                        <SportIconBadge sportName={b.court?.sports?.name} />
                        <View className="flex-1">
                          <Text className="text-ink text-sm font-medium">{formatTimeRange(b.start_time, b.end_time)}</Text>
                          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                            {b.court?.name ?? "Court"}
                          </Text>
                        </View>
                      </View>
                      {badge && (
                        <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                          <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </SectionCard>

            <SectionCard title="Revenue Overview">
              <View className="flex-row items-baseline justify-between mb-3">
                <View>
                  <Text className="text-muted text-xs">Total Revenue ({weekly.periodLabel})</Text>
                  <Text className="text-ink font-extrabold text-2xl mt-0.5">Rs {weekly.total.toLocaleString()}</Text>
                </View>
                <DeltaLabel value={weekly.deltaPct} suffix={`% vs previous ${weekly.periodLabel.replace("last ", "")}`} />
              </View>

              <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4" style={{ gap: 4 }}>
                {(["days", "weeks", "months", "year"] as RevenueScale[]).map((scale) => (
                  <Pressable
                    key={scale}
                    onPress={() => setRevenueScale(scale)}
                    className="flex-1 items-center py-1.5 rounded-lg"
                    style={{ backgroundColor: revenueScale === scale ? "white" : "transparent" }}
                  >
                    <Text
                      className="text-xs font-semibold capitalize"
                      style={{ color: revenueScale === scale ? colors.primary : colors.muted }}
                    >
                      {scale}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <RevenueBarChart labels={weekly.labels} values={weekly.values} />
            </SectionCard>

            <SectionCard title="Upcoming Bookings">
              {upcoming.length === 0 ? (
                <Text className="text-muted text-sm py-2">No upcoming bookings yet.</Text>
              ) : (
                upcoming.map((b) => {
                  const badge = STATUS_BADGE[b.status];
                  return (
                    <View key={b.id} className="flex-row items-center justify-between py-2 border-b border-border">
                      <View className="flex-row items-center flex-1 pr-2" style={{ gap: 10 }}>
                        <SportIconBadge sportName={b.court?.sports?.name} />
                        <View className="flex-1">
                          <Text className="text-ink text-sm font-medium" numberOfLines={1}>
                            {b.court?.name ?? "Court"} · {b.profiles?.full_name ?? "Customer"}
                          </Text>
                          <Text className="text-muted text-xs mt-0.5">{formatTimeRange(b.start_time, b.end_time)}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        {badge && (
                          <View className={`px-2.5 py-1 rounded-full mb-1 ${badge.bg}`}>
                            <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
                          </View>
                        )}
                        <Text className="text-ink text-xs font-semibold">Rs {b.total_amount.toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </SectionCard>

            {topVenues.length > 0 && (
              <SectionCard title="Top Venues">
                {topVenues.map((v) => (
                  <View key={v.venueId} className="flex-row items-center justify-between py-2 border-b border-border">
                    <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                      {v.name}
                    </Text>
                    <Text className="text-muted text-xs mr-3">{v.bookingsCount} bookings</Text>
                    <Text className="text-ink text-xs font-semibold">Rs {v.revenue.toLocaleString()}</Text>
                  </View>
                ))}
              </SectionCard>
            )}

            <SectionCard title="Recent Notifications">
              {recent.length === 0 ? (
                <Text className="text-muted text-sm py-2">No recent activity yet.</Text>
              ) : (
                recent.map((b) => (
                  <View key={b.id} className="flex-row items-start py-2 border-b border-border" style={{ gap: 10 }}>
                    <SportIconBadge sportName={b.court?.sports?.name} size={32} />
                    <View className="flex-1">
                      <Text className="text-ink text-sm font-medium">
                        {b.court?.name ?? "A court"} booked for {formatTimeRange(b.start_time, b.end_time)}
                      </Text>
                      <Text className="text-muted text-xs mt-0.5">{b.profiles?.full_name ?? "Customer"}</Text>
                    </View>
                  </View>
                ))
              )}
            </SectionCard>

          </View>
        </View>
      </ScrollView>

      <AdminMenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} activeKey="dashboard" items={menuItems} />

      <Modal visible={switcherOpen} animationType="slide" transparent onRequestClose={() => setSwitcherOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Switch Venue</Text>
              <Pressable onPress={() => setSwitcherOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {(myVenues ?? []).map((v) => (
              <Pressable
                key={v.id}
                onPress={() => {
                  setSwitcherOpen(false);
                  navigation.setParams({ venueId: v.id });
                }}
                className="flex-row items-center justify-between py-3 border-b border-border"
              >
                <Text className="text-ink text-sm font-medium">{v.name}</Text>
                {v.id === params.venueId && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={hourlyModalOpen} animationType="slide" transparent onRequestClose={() => setHourlyModalOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ maxHeight: "85%", paddingBottom: insets.bottom + 16 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Today, Hour by Hour</Text>
              <Pressable onPress={() => setHourlyModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            {venue.court.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {venue.court.map((c) => {
                  const active = c.id === hourlyCourtId;
                  return (
                    <Pressable key={c.id} onPress={() => setHourlyCourtId(c.id)}>
                      {active ? (
                        <GradientFill className="rounded-full px-3 py-2">
                          <Text className="text-sm font-medium text-white">{c.name}</Text>
                        </GradientFill>
                      ) : (
                        <View
                          className="rounded-full px-3 py-2"
                          style={{ backgroundColor: "white", borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text className="text-sm font-medium text-ink">{c.name}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {generateFullDaySlots().map((slot: Slot) => {
                const today = toLocalDateStr(new Date());
                const s = slotBoundaryDateTime(today, slot.start, false).getTime();
                const e = slotBoundaryDateTime(today, slot.end, true).getTime();
                const match = (bookings ?? []).find((b: VenueBooking) => {
                  if (b.court?.id !== hourlyCourtId) return false;
                  const bs = new Date(b.start_time).getTime();
                  const be = new Date(b.end_time).getTime();
                  return s < be && e > bs;
                });
                const isBlocked = match?.status === "BLOCKED";
                const isBooked = !!match && !isBlocked;
                const badge = isBlocked
                  ? { bg: "bg-red-50", text: "text-red-600", label: "Blocked" }
                  : isBooked
                    ? { bg: "bg-blue-50", text: "text-blue-600", label: "Booked" }
                    : { bg: "bg-green-50", text: "text-green-700", label: "Available" };

                return (
                  <View key={slot.start} className="flex-row items-center justify-between py-2 border-b border-border">
                    <Text className="text-ink text-sm">{slot.label}</Text>
                    <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                      <Text className={`text-xs font-medium ${badge.text}`}>
                        {badge.label}
                        {isBooked && match?.profiles?.full_name ? ` · ${match.profiles.full_name}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
