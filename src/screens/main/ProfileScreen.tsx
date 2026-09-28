import { useCallback, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Modal, Alert, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useIsFocused, useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { useAuthStore } from "../../store/authStore";
import { useProfileStats } from "../../hooks/useProfileStats";
import { usePlayerPublicProfile } from "../../hooks/usePlayers";
import { useFollowState } from "../../hooks/usePlayerFollows";
import { computeRating, computeRankingRating, getRatingTierInfo } from "../../lib/playerRating";
import PieChart from "../../components/PieChart";
import { getSportIcon } from "../../lib/sportIcons";
import { pickImages, uploadImage } from "../../lib/upload";
import { colors, cardShadow } from "../../constants/theme";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";
import type { Database } from "../../types/database.types";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { signOutWithPushCleanup } from "../../lib/pushNotifications";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
];

const CARD_SHADOW = {
  borderWidth: 1,
  borderColor: "rgba(17, 24, 39, 0.06)",
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 14,
  elevation: 4,
} as const;

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard({
  icon,
  bg,
  fg,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  value: string | number;
  label: string;
}) {
  return (
    <View
      style={{ width: "31%", borderRadius: 16, padding: 12, backgroundColor: "white", ...cardShadow }}
    >
      <View className="mb-2">
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 34, height: 34, backgroundColor: bg }}
        >
          <Ionicons name={icon} size={17} color={fg} />
        </View>
      </View>
      <Text className="text-ink font-extrabold text-xl">{value}</Text>
      <Text className="text-[11px] mt-0.5" style={{ color: colors.muted }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function EnrolledRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between bg-white border border-border rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-1 mr-2">
        <Text className="text-ink font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function ActivityBarRow({
  icon,
  iconBg,
  label,
  value,
  max,
  color,
  light,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  value: number;
  max: number;
  color: string;
  // On a dark/gradient card the label+value need light text and a
  // translucent track instead of the default dark-on-white styling.
  light?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-row items-center flex-1 mr-2" style={{ gap: 8 }}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 24, height: 24, backgroundColor: iconBg }}
          >
            <Ionicons name={icon} size={12} color={color} />
          </View>
          <Text
            className="text-sm font-medium"
            style={{ color: light ? "rgba(255,255,255,0.9)" : colors.ink }}
          >
            {label}
          </Text>
        </View>
        <Text className="text-sm font-bold" style={{ color: light ? "white" : colors.ink }}>
          {value}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: light ? "rgba(255,255,255,0.18)" : "#F3F4F6",
          overflow: "hidden",
        }}
      >
        <View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

function SquadChip({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-xl px-3 py-2.5 mr-2"
      style={{ backgroundColor: "white", ...CARD_SHADOW, gap: 8, width: 160 }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 34, height: 34, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="people" size={16} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <Text className="text-ink font-semibold text-xs" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-muted text-[10px] mt-0.5" numberOfLines={1}>
          Active member
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
  );
}

type ProfileScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // Profile is a bottom-tab root — the phone's hardware/gesture back button
  // should take the user to the Home tab instead of exiting the app.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (navigation.canGoBack()) return false;
        navigation.getParent()?.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  const [filterSportId, setFilterSportId] = useState<string | undefined>(undefined);
  const [filterSportName, setFilterSportName] = useState<string | undefined>(undefined);
  // Every card below (rating, stat grid, sports chart, activity, Games Win)
  // follows the selected sport, so they're all fetched narrowed to it.
  const { data: stats, isLoading } = useProfileStats(userId, filterSportId);
  // The same public-profile numbers other players see on this person's
  // Top Players detail page (Games Win, sport totals, Sports Played, followers).
  // Tapping a "Sports Played" card narrows Games Win + the sport totals to that
  // one sport; tapping it again clears the filter.
  const { data: player } = usePlayerPublicProfile(userId, filterSportId);
  // The Sports Played list is the sport selector, so it always lists every
  // sport (the filtered profile above only returns the selected one).
  const { data: allSportsProfile } = usePlayerPublicProfile(userId);
  const sportsPlayed = allSportsProfile?.sportBreakdown ?? [];
  const { data: followState } = useFollowState(userId, userId);
  const handleSelectSportCard = (sportId: string, sportName: string) => {
    if (filterSportId === sportId) {
      setFilterSportId(undefined);
      setFilterSportName(undefined);
    } else {
      setFilterSportId(sportId);
      setFilterSportName(sportName);
    }
  };
  const matchesWon = player?.matchesWonTotal ?? 0;
  const matchesPlayed = player?.matchesPlayedTotal ?? 0;
  const winPercentage = matchesPlayed > 0 ? Math.min(100, Math.round((matchesWon / matchesPlayed) * 100)) : 0;
  let winTag: string | null = null;
  let winCaption = "Play more scored games to build this up.";
  if (matchesPlayed > 0) {
    if (winPercentage === 100) {
      winTag = "Perfect!";
      winCaption = "Great performance! Keep it up!";
    } else if (winPercentage >= 70) {
      winTag = "Great!";
      winCaption = "Strong performance — keep it going!";
    } else if (winPercentage >= 40) {
      winCaption = "Solid effort — keep grinding!";
    } else {
      winCaption = "Room to improve — keep playing!";
    }
  }
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);

  const handleCopyUserId = async () => {
    if (!profile?.user_code) return;
    await Clipboard.setStringAsync(profile.user_code);
    setUserIdCopied(true);
    setTimeout(() => setUserIdCopied(false), 1500);
  };

  async function handleChangeAvatar() {
    if (!userId) return;
    const assets = await pickImages({ allowsEditing: true, aspect: [1, 1] });
    if (assets.length === 0) return;

    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadImage(assets[0], { bucket: "avatars", pathPrefix: userId });
      await updateProfile(userId, { avatar: publicUrl });
    } catch (err) {
      Alert.alert("Upload failed", getFriendlyErrorMessage(err, "Could not upload photo."));
    } finally {
      setUploadingAvatar(false);
    }
  }

  const effectiveSkillLevel = profile?.skill_level ?? stats?.computedSkillLevel ?? null;
  // Same rating (and tier) the Top Players list shows for this person.
  const rating = computeRankingRating(stats);
  const ratingTier = getRatingTierInfo(rating);

  const sportSegments = (stats?.sportBreakdown ?? []).map((s) => ({
    label: s.sportName,
    value: s.count,
    color: getSportIcon(s.sportName).fg,
  }));

  // Percentages are each sport's share of the chart's own total, so every one
  // is between 0 and 100 and together they make up the whole pie.
  const sportTotal = Math.max(1, sportSegments.reduce((sum, s) => sum + s.value, 0));
  const regularGamesPlayed = stats?.regularGamesPlayedTotal ?? 0;
  const activityMax = Math.max(regularGamesPlayed, stats?.tournamentsPlayedTotal ?? 0, stats?.gamesHostedTotal ?? 0, 1);

  async function handlePickSkillLevel(level: SkillLevel) {
    if (!userId) return;
    setSavingSkill(true);
    try {
      await updateProfile(userId, { skill_level: level });
      setSkillPickerOpen(false);
    } finally {
      setSavingSkill(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      {isFocused ? <StatusBar style="light" /> : null}
      {/* Fixed dark-green banner — same treatment as the Community tab's header. */}
      <View
        style={{
          backgroundColor: "#14532D",
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => {
              // Profile is a bottom-tab root, so there's usually nothing to
              // pop to — fall back to the Home tab in that case.
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.getParent()?.navigate("Home");
            }}
            hitSlop={8}
            className="mr-3"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} className="relative mr-4">
            {profile?.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                className="w-16 h-16 rounded-full bg-primary-light border-[3px] border-[#AEE7C3]"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center border-[3px] border-[#AEE7C3]">
                <Text className="text-xl font-bold text-primary">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-full">
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View
                className="absolute bottom-0 right-0 items-center justify-center rounded-full bg-primary"
                style={{ width: 24, height: 24, borderWidth: 2, borderColor: "white" }}
              >
                <Ionicons name="camera" size={12} color="white" />
              </View>
            )}
          </Pressable>
          <View className="flex-1 mr-2">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Text className="text-white font-bold text-2xl" numberOfLines={1}>
                {profile?.full_name ?? "Profile"}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color="#4ADE80" />
            </View>
            <Pressable onPress={handleCopyUserId} className="flex-row items-center mt-1" style={{ gap: 4 }} hitSlop={6}>
              <Ionicons name="pricetag-outline" size={12} color="#BBF7D0" />
              <Text style={{ color: "#BBF7D0" }} className="text-sm" numberOfLines={1}>
                ID: {profile?.user_code ?? "—"}
              </Text>
              <Ionicons name={userIdCopied ? "checkmark" : "copy-outline"} size={12} color="#BBF7D0" />
            </Pressable>
            {profile?.created_at ? (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="calendar-outline" size={12} color="#BBF7D0" />
                <Text style={{ color: "#BBF7D0" }} className="text-xs">Member since {formatMonthYear(profile.created_at)}</Text>
              </View>
            ) : null}
            {(followState?.followerCount ?? 0) > 0 && (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="people-outline" size={12} color="#BBF7D0" />
                <Text style={{ color: "#BBF7D0" }} className="text-xs">
                  {followState!.followerCount} follower{followState!.followerCount === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate("AccountSettings")}
            className="items-center justify-center bg-white rounded-full"
            style={{ width: 50, height: 50, ...CARD_SHADOW }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primaryDark} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
      <View className="px-6" style={{ paddingTop: 20 }}>
        {/* Rating card */}
        <View
          style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 16, marginBottom: 24, position: "relative" }}
        >
          <View style={{ position: "absolute", right: 14, top: 16, alignItems: "flex-end" }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 6,
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: "700",
                  fontStyle: "italic",
                  textAlign: "right",
                  opacity: 0.75,
                }}
              >
                {"Play More\nGet Better"}
              </Text>
              <Ionicons name="trending-up" size={14} color={colors.muted} style={{ marginTop: 4, opacity: 0.75, alignSelf: "flex-end" }} />
            </View>
          </View>
          <Text className="text-xs font-bold mb-2" style={{ letterSpacing: 0.5, color: colors.muted }}>
            Your Rating
          </Text>
          <View className="flex-row items-center justify-between mb-2" style={{ maxWidth: "70%" }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons
                  name="hexagon"
                  size={52}
                  color={ratingTier.bg}
                  style={{ position: "absolute" }}
                />
                <Ionicons name="trophy" size={22} color={ratingTier.color} />
              </View>
              <Text className="text-ink font-extrabold" style={{ fontSize: 34, lineHeight: 38 }}>
                {rating}
              </Text>
              <Ionicons name="star" size={16} color="#FACC15" style={{ marginTop: -18 }} />
            </View>
          </View>
          <View className="flex-row items-center mb-2" style={{ gap: 4 }}>
            <Text className="text-xs" style={{ color: colors.muted }}>
              {ratingTier.nextLabel ? `${ratingTier.remaining} points to ${ratingTier.nextLabel}` : "Top tier"}
            </Text>
            <Ionicons name="information-circle-outline" size={13} color={colors.muted} />
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "#F3F4F6" }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                width: `${ratingTier.progress * 100}%`,
                backgroundColor: ratingTier.color,
              }}
            />
          </View>
          <View
            className="flex-row items-center self-end rounded-full pl-3 pr-2 py-1.5 mt-3"
            style={{ backgroundColor: ratingTier.bg, gap: 2 }}
          >
            <Text className="text-xs font-bold" style={{ color: ratingTier.color }}>
              {ratingTier.label}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={ratingTier.color} />
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} className="my-8" />
        ) : (
          <>
            {/* Stat grid */}
            <View className="flex-row flex-wrap justify-between mb-6" style={{ rowGap: 12 }}>
              <StatCard icon="football-outline" bg="#EFF6FF" fg="#2563EB" value={stats?.gamesPlayedTotal ?? 0} label="Games Played" />
              <StatCard icon="trophy-outline" bg="#FFFBEB" fg="#D97706" value={stats?.tournamentsPlayedTotal ?? 0} label="Tournaments Played" />
              <StatCard icon="star-outline" bg="#FFF1F2" fg="#E11D48" value={stats?.gamesHostedTotal ?? 0} label="Games Hosted" />
              <StatCard icon="people-outline" bg="#F0FDF4" fg="#16A34A" value={stats?.activeSquads.length ?? 0} label="Active Squads" />
              <StatCard icon="time-outline" bg="#EFF6FF" fg="#2563EB" value={stats?.hoursPlayedTotal ?? 0} label="Hours Played" />
              <StatCard icon="pulse-outline" bg="#F5F3FF" fg="#7C3AED" value={computeRating(stats)} label="Participation Score" />
            </View>

            {/* Sport breakdown + activity, side by side */}
            <View className="flex-row mb-6 items-stretch" style={{ gap: 12 }}>
              <View
                style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14, flex: 1, position: "relative" }}
              >
                <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                  <Ionicons name="pie-chart" size={15} color={colors.primary} />
                  <Text className="text-ink font-semibold" numberOfLines={1}>
                    Sports You Play
                  </Text>
                </View>
                {sportSegments.length === 0 ? (
                  <View className="items-center py-4">
                    <Ionicons name="bar-chart-outline" size={24} color="#9CA3AF" />
                    <Text className="text-xs mt-2 text-center" style={{ color: colors.muted }}>
                      Play your first game to see this here.
                    </Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <View style={{ width: 110, height: 110 }}>
                      <PieChart segments={sportSegments} size={110} gapColor="white" />
                      <View
                        pointerEvents="none"
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
                      >
                        <View
                          className="items-center justify-center rounded-full"
                          style={{ width: 60, height: 60, backgroundColor: "white" }}
                        >
                          <Text className="text-ink font-extrabold" style={{ fontSize: 20 }}>
                            {sportSegments.length}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>Sports</Text>
                        </View>
                      </View>
                    </View>
                    <View className="w-full mt-3" style={{ gap: 6 }}>
                      {sportSegments.map((s) => (
                        <View key={s.label} className="flex-row items-center" style={{ gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                          <Text className="text-xs flex-1" style={{ color: colors.muted }} numberOfLines={1}>
                            {s.label}
                          </Text>
                          <Text className="text-[11px]" style={{ color: colors.muted }}>
                            {Math.round((s.value / sportTotal) * 100)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View
                style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14, flex: 1 }}
              >
                <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                  <Ionicons name="bar-chart" size={15} color={colors.primary} />
                  <Text className="text-ink font-semibold" numberOfLines={1}>
                    Your Activity
                  </Text>
                </View>
                <ActivityBarRow icon="game-controller" iconBg="#F0FDF4" label="Regular Games" value={regularGamesPlayed} max={activityMax} color="#60A5FA" />
                <ActivityBarRow icon="trophy" iconBg="#FFFBEB" label="Tournaments" value={stats?.tournamentsPlayedTotal ?? 0} max={activityMax} color="#FBBF24" />
                <ActivityBarRow icon="people" iconBg="#FAF5FF" label="Games Hosted" value={stats?.gamesHostedTotal ?? 0} max={activityMax} color="#C084FC" />
              </View>
            </View>

            {/* Games Win — same green card look as the rest of the Profile cards */}
            <View
              style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 16, marginBottom: 16 }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1 mr-2" style={{ gap: 10 }}>
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, backgroundColor: "#F0FDF4" }}
                  >
                    <Ionicons name="locate" size={20} color="#16A34A" />
                  </View>
                  <View>
                    <Text className="text-ink font-extrabold text-xl">
                      {matchesWon} / {matchesPlayed}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                      {filterSportName ? `Games Win · ${filterSportName}` : "Games Win"}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-ink font-extrabold text-lg">{winPercentage}%</Text>
                  {winTag && (
                    <View className="rounded-full px-2 py-0.5 mt-1" style={{ backgroundColor: "#F3F4F6" }}>
                      <Text className="text-[10px] font-bold text-ink">{winTag}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: "#F3F4F6" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${winPercentage}%`, backgroundColor: colors.primary }} />
              </View>
              <Text className="text-xs mt-2" style={{ color: colors.muted }}>{winCaption}</Text>
            </View>

            {/* Sport-specific totals — only once filtered to that one sport */}
            {player && filterSportName?.toLowerCase() === "cricket" && (
              <View className="flex-row mb-4" style={{ gap: 12 }}>
                <View
                  style={{ backgroundColor: "white", ...cardShadow, flex: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, backgroundColor: "#F0FDF4" }}
                  >
                    <MaterialCommunityIcons name="cricket" size={22} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink font-extrabold text-xl">{player.totalRuns}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>Total Runs</Text>
                  </View>
                </View>
                <View
                  style={{ backgroundColor: "white", ...cardShadow, flex: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, backgroundColor: "#F0FDF4" }}
                  >
                    <MaterialCommunityIcons name="bowling" size={22} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink font-extrabold text-xl">{player.totalWickets}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>Total Wickets</Text>
                  </View>
                </View>
              </View>
            )}
            {player && filterSportName?.toLowerCase() === "football" && (
              <View
                  style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, backgroundColor: "#F0FDF4" }}
                  >
                    <MaterialCommunityIcons name="soccer" size={22} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink font-extrabold text-xl">{player.totalGoals}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>Total Goals</Text>
                  </View>
                </View>
            )}

            {/* Sports Played — tap one to filter Games Win and the sport totals above */}
            {sportsPlayed.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-ink">Sports Played</Text>
                  <View
                    className="flex-row items-center rounded-full px-2.5 py-1"
                    style={{ backgroundColor: colors.primaryLight, gap: 4 }}
                  >
                    <Ionicons name="bar-chart" size={12} color={colors.primaryDark} />
                    <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
                      {sportsPlayed.length} {sportsPlayed.length === 1 ? "Sport" : "Sports"}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {sportsPlayed.map((sp) => {
                    const { icon, bg, fg } = getSportIcon(sp.sportName);
                    const selected = filterSportId === sp.sportId;
                    return (
                      <Pressable
                        key={sp.sportId}
                        onPress={() => handleSelectSportCard(sp.sportId, sp.sportName)}
                        style={{
                          borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: selected ? colors.primary : "transparent",
                        }}
                      >
                        <View
                          style={{ flexDirection: "row", alignItems: "center", padding: 12 }}
                        >
                          <View
                            className="items-center justify-center rounded-xl mr-3"
                            style={{ width: 46, height: 46, backgroundColor: bg }}
                          >
                            <MaterialCommunityIcons name={icon} size={22} color={fg} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
                              {sp.sportName}
                            </Text>
                            <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                              {sp.count} {sp.count === 1 ? "game" : "games"}
                            </Text>
                          </View>
                          {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        <Pressable
          onPress={async () => {
            await signOutGoogle();
            signOutWithPushCleanup();
          }}
          className="bg-primary rounded-xl py-4 items-center mt-2"
        >
          <Text className="text-white font-semibold" style={{ fontSize: 17 }}>Sign out</Text>
        </Pressable>
      </View>

      <Modal visible={skillPickerOpen} transparent animationType="fade" onRequestClose={() => setSkillPickerOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setSkillPickerOpen(false)}
        >
          <Pressable className="bg-white rounded-2xl p-5 w-full" onPress={(e) => e.stopPropagation()}>
            <Text className="text-ink font-bold text-lg mb-1">Your Skill Level</Text>
            <Text className="text-muted text-sm mb-4">Helps hosts match you to the right games.</Text>
            {SKILL_LEVELS.map((level) => {
              const selected = effectiveSkillLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  disabled={savingSkill}
                  onPress={() => handlePickSkillLevel(level.value)}
                  className={`flex-row items-center justify-between rounded-xl px-4 py-3 mb-2 border ${
                    selected ? "bg-primary-light border-primary" : "bg-white border-border"
                  }`}
                >
                  <Text className={`font-medium ${selected ? "text-primary-dark" : "text-ink"}`}>{level.label}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
      </ScrollView>
    </View>
  );
}
