import { useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Modal, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { useAuthStore } from "../../store/authStore";
import { useProfileStats } from "../../hooks/useProfileStats";
import type { ProfileStats } from "../../lib/api/profileStats";
import { computeRating, computeRankingRating, getRatingTierInfo } from "../../lib/playerRating";
import PieChart from "../../components/PieChart";
import { getSportIcon } from "../../lib/sportIcons";
import { pickImages, uploadImage } from "../../lib/upload";
import { colors } from "../../constants/theme";
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

type Achievement = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; unlocked: boolean };

function buildAchievements(stats: ProfileStats): Achievement[] {
  return [
    { key: "first-game", label: "First Game", icon: "flag-outline", unlocked: stats.gamesPlayedTotal >= 1 },
    { key: "regular", label: "5 Games Played", icon: "repeat-outline", unlocked: stats.gamesPlayedTotal >= 5 },
    { key: "veteran", label: "25 Games Played", icon: "shield-checkmark-outline", unlocked: stats.gamesPlayedTotal >= 25 },
    { key: "tournament", label: "Tournament Debut", icon: "trophy-outline", unlocked: stats.tournamentsPlayedTotal >= 1 },
    { key: "squad", label: "Team Player", icon: "people-outline", unlocked: stats.activeSquads.length >= 1 },
    { key: "host", label: "Game Host", icon: "star-outline", unlocked: stats.gamesHostedTotal >= 1 },
    { key: "venues", label: "Venue Explorer", icon: "location-outline", unlocked: stats.favoriteVenuesCount >= 3 },
  ];
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
    <View className="bg-white rounded-2xl p-3" style={{ width: "31%", ...CARD_SHADOW }}>
      <View
        className="items-center justify-center rounded-full mb-2"
        style={{ width: 34, height: 34, backgroundColor: bg }}
      >
        <Ionicons name={icon} size={17} color={fg} />
      </View>
      <Text className="text-ink font-extrabold text-xl">{value}</Text>
      <Text className="text-muted text-[11px] mt-0.5" numberOfLines={2}>
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

function ActivityBarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-ink text-sm font-medium">{label}</Text>
        <Text className="text-muted text-sm">{value}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
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

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <View style={{ width: "31%", alignItems: "center", marginBottom: 16 }}>
      <View
        className="items-center justify-center rounded-full mb-1.5"
        style={{ width: 52, height: 52, backgroundColor: achievement.unlocked ? colors.primaryLight : "#F3F4F6" }}
      >
        <Ionicons
          name={achievement.unlocked ? achievement.icon : "lock-closed-outline"}
          size={22}
          color={achievement.unlocked ? colors.primaryDark : "#9CA3AF"}
        />
      </View>
      <Text
        className="text-center text-xs"
        style={{ color: achievement.unlocked ? colors.ink : "#9CA3AF" }}
        numberOfLines={2}
      >
        {achievement.label}
      </Text>
    </View>
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
  const { data: stats, isLoading } = useProfileStats(userId);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

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
  const achievements = stats ? buildAchievements(stats) : [];

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
    <ScrollView
      className="flex-1 bg-green-50"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} className="relative mr-4">
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} className="w-20 h-20 rounded-full bg-primary-light" />
            ) : (
              <View className="w-20 h-20 rounded-full bg-primary-light items-center justify-center">
                <Text className="text-3xl font-bold text-primary">
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
            <Text className="text-2xl font-bold text-ink" numberOfLines={1}>
              {profile?.full_name ?? "Profile"}
            </Text>
            <Text className="text-muted text-sm" numberOfLines={1}>
              {profile?.email}
            </Text>
            {profile?.created_at ? (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                <Text className="text-muted text-xs">Member since {formatMonthYear(profile.created_at)}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => navigation.navigate("AccountSettings")}
            className="items-center justify-center bg-white rounded-full"
            style={{ width: 38, height: 38, ...CARD_SHADOW }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primaryDark} />
          </Pressable>
        </View>

        {/* Rating card */}
        <View className="rounded-2xl p-4 mb-4 overflow-hidden" style={{ backgroundColor: "#0E4429" }}>
          <Ionicons
            name="stats-chart"
            size={90}
            color="white"
            style={{ position: "absolute", right: -10, bottom: -16, opacity: 0.1 }}
          />
          <View style={{ position: "absolute", right: 14, top: 16, alignItems: "flex-end" }}>
            <Text
              numberOfLines={2}
              style={{
                color: "white",
                fontSize: 11,
                fontWeight: "700",
                fontStyle: "italic",
                textAlign: "right",
                opacity: 0.55,
              }}
            >
              {"Play More\nGet Better"}
            </Text>
            <Ionicons name="trending-up" size={14} color="white" style={{ marginTop: 4, opacity: 0.55 }} />
          </View>
          <Text className="text-xs font-bold mb-2" style={{ letterSpacing: 0.5, color: "rgba(255,255,255,0.75)" }}>
            Your Rating
          </Text>
          <View className="flex-row items-center justify-between mb-2" style={{ maxWidth: "70%" }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: ratingTier.bg }}
              >
                <Ionicons name="flame" size={22} color={ratingTier.color} />
              </View>
              <Text className="text-white font-extrabold" style={{ fontSize: 34, lineHeight: 38 }}>
                {rating}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
              {ratingTier.nextLabel ? `${ratingTier.remaining} points to ${ratingTier.nextLabel}` : "Top tier"}
            </Text>
            <View className="flex-row items-center rounded-full pl-2.5 pr-1.5 py-1" style={{ backgroundColor: ratingTier.bg, gap: 2 }}>
              <Text className="text-xs font-bold" style={{ color: ratingTier.color }}>
                {ratingTier.label}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={ratingTier.color} />
            </View>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                width: `${ratingTier.progress * 100}%`,
                backgroundColor: ratingTier.color,
              }}
            />
          </View>
        </View>

        {/* Skill level card */}
        <Pressable
          onPress={() => setSkillPickerOpen(true)}
          className="flex-row items-center justify-between rounded-2xl px-4 py-3.5 mb-6"
          style={{ backgroundColor: colors.primaryLight }}
        >
          <View className="flex-row items-center flex-1" style={{ gap: 12 }}>
            <View
              className="items-center justify-center rounded-2xl"
              style={{ width: 44, height: 44, backgroundColor: colors.primaryDark }}
            >
              <Ionicons name="medal-outline" size={22} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-medium" style={{ color: colors.primaryDark, opacity: 0.75 }}>
                Skill Level
              </Text>
              <Text className="font-extrabold text-lg" style={{ color: colors.primaryDark }}>
                {effectiveSkillLevel ? capitalize(effectiveSkillLevel) : "Not set"}
              </Text>
              <Text className="text-xs" style={{ color: colors.primaryDark, opacity: 0.6 }}>
                Tap to update
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
        </Pressable>

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
            <View className="flex-row mb-6" style={{ gap: 12 }}>
              <View className="bg-white rounded-2xl p-3.5 flex-1" style={CARD_SHADOW}>
                <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                  <Ionicons name="star" size={15} color={colors.primaryDark} />
                  <Text className="text-ink font-semibold" numberOfLines={1}>
                    Sports You Play
                  </Text>
                </View>
                {sportSegments.length === 0 ? (
                  <View className="items-center py-4">
                    <Ionicons name="bar-chart-outline" size={24} color={colors.muted} />
                    <Text className="text-muted text-xs mt-2 text-center">
                      Play your first game to see this here.
                    </Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <PieChart segments={sportSegments} size={110} />
                    <View className="w-full mt-3" style={{ gap: 6 }}>
                      {sportSegments.map((s) => (
                        <View key={s.label} className="flex-row items-center" style={{ gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                          <Text className="text-ink text-xs flex-1" numberOfLines={1}>
                            {s.label}
                          </Text>
                          <Text className="text-muted text-[11px]">{Math.round((s.value / sportTotal) * 100)}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View className="bg-white rounded-2xl p-3.5 flex-1" style={CARD_SHADOW}>
                <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                  <Ionicons name="bar-chart" size={15} color={colors.primaryDark} />
                  <Text className="text-ink font-semibold" numberOfLines={1}>
                    Your Activity
                  </Text>
                </View>
                <ActivityBarRow label="Regular Games" value={regularGamesPlayed} max={activityMax} color="#2563EB" />
                <ActivityBarRow label="Tournaments" value={stats?.tournamentsPlayedTotal ?? 0} max={activityMax} color="#D97706" />
                <ActivityBarRow label="Games Hosted" value={stats?.gamesHostedTotal ?? 0} max={activityMax} color="#A21CAF" />
              </View>
            </View>

            {/* Achievements */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name="trophy" size={16} color={colors.primaryDark} />
                <Text className="text-lg font-semibold text-ink">Achievements</Text>
              </View>
              {achievements.length > 6 ? (
                <Pressable
                  onPress={() => setShowAllAchievements((v) => !v)}
                  className="flex-row items-center"
                  style={{ gap: 2 }}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.primaryDark }}>
                    {showAllAchievements ? "Show less" : "See all"}
                  </Text>
                  <Ionicons
                    name={showAllAchievements ? "chevron-up" : "chevron-forward"}
                    size={14}
                    color={colors.primaryDark}
                  />
                </Pressable>
              ) : null}
            </View>
            <View className="flex-row flex-wrap justify-between mb-3">
              {(showAllAchievements ? achievements : achievements.slice(0, 6)).map((a) => (
                <AchievementBadge key={a.key} achievement={a} />
              ))}
            </View>

          </>
        )}

        {/* My Bookings */}
        <Pressable
          onPress={() => navigation.navigate("MyBookings")}
          className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3 mb-3 mt-2"
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Ionicons name="calendar-outline" size={20} color={colors.ink} />
            <Text className="text-ink font-medium">My Bookings</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("BlockedUsers")}
          className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3 mb-3"
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Ionicons name="hand-left-outline" size={20} color={colors.ink} />
            <Text className="text-ink font-medium">Blocked Users</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={async () => {
            await signOutGoogle();
            signOutWithPushCleanup();
          }}
          className="bg-primary rounded-xl py-3 items-center"
        >
          <Text className="text-white font-semibold">Sign out</Text>
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
  );
}
