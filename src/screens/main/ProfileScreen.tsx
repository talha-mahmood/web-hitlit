import { useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signOutGoogle } from "../../lib/googleAuth";
import { useProfileStore } from "../../store/profileStore";
import { useAuthStore } from "../../store/authStore";
import { useProfileStats } from "../../hooks/useProfileStats";
import type { ProfileStats } from "../../lib/api/profileStats";
import DonutChart from "../../components/DonutChart";
import { getSportIcon } from "../../lib/sportIcons";
import { colors } from "../../constants/theme";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";
import type { Database } from "../../types/database.types";

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

// A numeric rating (à la 8 Ball Pool / Chess.com) rather than a skill ELO —
// this app has no win/loss data to base a real competitive rating on, so
// it's activity-driven: it only ever goes up as you play more, host, and
// enter tournaments. Deliberately slow: everyone starts at 0, and a regular
// game is worth 1 point, so a rating of 100 genuinely means ~100 games
// played — reaching it should take real, sustained participation.
const BASE_RATING = 0;
const POINTS_PER_GAME = 1;
const POINTS_PER_TOURNAMENT = 3;
const POINTS_PER_HOSTED_GAME = 2;

const RATING_TIERS = [
  { label: "Rookie", min: 0, color: "#6B7280", bg: "#F3F4F6" },
  { label: "Bronze", min: 10, color: "#B45309", bg: "#FFFBEB" },
  { label: "Silver", min: 25, color: "#64748B", bg: "#F1F5F9" },
  { label: "Gold", min: 50, color: "#CA8A04", bg: "#FEFCE8" },
  { label: "Platinum", min: 100, color: "#0891B2", bg: "#ECFEFF" },
  { label: "Diamond", min: 200, color: "#7C3AED", bg: "#F5F3FF" },
] as const;

function computeRating(stats: ProfileStats | undefined): number {
  if (!stats) return BASE_RATING;
  const regularGames = Math.max(0, stats.gamesPlayedTotal - stats.tournamentsPlayedTotal);
  return (
    BASE_RATING +
    regularGames * POINTS_PER_GAME +
    stats.tournamentsPlayedTotal * POINTS_PER_TOURNAMENT +
    stats.gamesHostedTotal * POINTS_PER_HOSTED_GAME
  );
}

function getRatingTierInfo(rating: number) {
  let idx = 0;
  for (let i = 0; i < RATING_TIERS.length; i++) {
    if (rating >= RATING_TIERS[i].min) idx = i;
  }
  const current = RATING_TIERS[idx];
  const next = RATING_TIERS[idx + 1] ?? null;
  const progress = next ? (rating - current.min) / (next.min - current.min) : 1;
  return {
    label: current.label,
    color: current.color,
    bg: current.bg,
    progress: Math.max(0, Math.min(1, progress)),
    nextLabel: next?.label ?? null,
    remaining: next ? next.min - rating : 0,
  };
}

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
    <View className="bg-white rounded-2xl p-4" style={{ width: "48%", ...CARD_SHADOW }}>
      <View
        className="items-center justify-center rounded-full mb-3"
        style={{ width: 40, height: 40, backgroundColor: bg }}
      >
        <Ionicons name={icon} size={20} color={fg} />
      </View>
      <Text className="text-ink font-extrabold text-2xl">{value}</Text>
      <Text className="text-muted text-xs mt-0.5">{label}</Text>
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

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const insets = useSafeAreaInsets();
  const { data: stats, isLoading } = useProfileStats(userId);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);

  const effectiveSkillLevel = profile?.skill_level ?? stats?.computedSkillLevel ?? null;
  const totalPlayed = stats?.gamesPlayedTotal ?? 0;
  const rating = computeRating(stats);
  const ratingTier = getRatingTierInfo(rating);

  const sportSegments = (stats?.sportBreakdown ?? []).map((s) => ({
    label: s.sportName,
    value: s.count,
    color: getSportIcon(s.sportName).fg,
  }));

  const regularGamesPlayed = Math.max(0, (stats?.gamesPlayedTotal ?? 0) - (stats?.tournamentsPlayedTotal ?? 0));
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
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} className="w-16 h-16 rounded-full bg-primary-light mr-4" />
          ) : (
            <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center mr-4">
              <Text className="text-2xl font-bold text-primary">
                {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">{profile?.full_name ?? "Profile"}</Text>
            <Text className="text-muted text-sm">{profile?.email}</Text>
            {profile?.created_at ? (
              <Text className="text-muted text-xs mt-0.5">Member since {formatMonthYear(profile.created_at)}</Text>
            ) : null}
          </View>
        </View>

        {/* Rating & skill card */}
        <View className="bg-white rounded-2xl p-4 mb-6" style={CARD_SHADOW}>
          <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>
            RATING
          </Text>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: ratingTier.bg }}
              >
                <Ionicons name="flame" size={20} color={ratingTier.color} />
              </View>
              <Text className="text-ink font-extrabold" style={{ fontSize: 30, lineHeight: 34 }}>
                {rating}
              </Text>
            </View>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: ratingTier.bg }}>
              <Text className="text-xs font-bold" style={{ color: ratingTier.color }}>
                {ratingTier.label}
              </Text>
            </View>
          </View>
          <Text className="text-muted text-xs mb-2">
            {ratingTier.nextLabel ? `${ratingTier.remaining} points to ${ratingTier.nextLabel}` : "Top tier"}
          </Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                width: `${ratingTier.progress * 100}%`,
                backgroundColor: ratingTier.color,
              }}
            />
          </View>

          <View className="h-px bg-border my-4" />

          <Text className="text-muted text-xs font-bold mb-2" style={{ letterSpacing: 0.5 }}>
            SKILL LEVEL
          </Text>
          <Pressable
            onPress={() => setSkillPickerOpen(true)}
            className="flex-row items-center justify-between rounded-xl px-3.5 py-3"
            style={{ backgroundColor: colors.primaryLight }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="medal-outline" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark }} className="font-semibold">
                {effectiveSkillLevel ? capitalize(effectiveSkillLevel) : "Tap to set your skill level"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} className="my-8" />
        ) : (
          <>
            {/* Stat grid */}
            <View className="flex-row flex-wrap justify-between mb-6" style={{ rowGap: 12 }}>
              <StatCard icon="football-outline" bg="#EFF6FF" fg="#2563EB" value={stats?.gamesPlayedTotal ?? 0} label="Games Played" />
              <StatCard icon="trophy-outline" bg="#FFFBEB" fg="#D97706" value={stats?.tournamentsPlayedTotal ?? 0} label="Tournaments Played" />
              <StatCard icon="star-outline" bg="#FDF4FF" fg="#A21CAF" value={stats?.gamesHostedTotal ?? 0} label="Games Hosted" />
              <StatCard icon="people-outline" bg="#F0FDF4" fg="#16A34A" value={stats?.activeSquads.length ?? 0} label="Active Squads" />
              <StatCard icon="time-outline" bg="#ECFEFF" fg="#0891B2" value={stats?.hoursPlayedTotal ?? 0} label="Hours Played" />
              <StatCard icon="heart-outline" bg="#FFF1F2" fg="#E11D48" value={stats?.favoriteVenuesCount ?? 0} label="Favorite Venues" />
            </View>

            {/* Sport breakdown donut */}
            <Text className="text-lg font-semibold text-ink mb-3">Sports You Play</Text>
            {sportSegments.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center mb-6" style={CARD_SHADOW}>
                <Ionicons name="bar-chart-outline" size={28} color={colors.muted} />
                <Text className="text-muted text-sm mt-2 text-center">
                  Play your first game to see your sport breakdown here.
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center mb-6" style={{ gap: 20 }}>
                <DonutChart segments={sportSegments} centerLabel={String(totalPlayed)} centerSubLabel="Games" />
                <View className="flex-1" style={{ gap: 8 }}>
                  {sportSegments.map((s) => (
                    <View key={s.label} className="flex-row items-center" style={{ gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                      <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                        {s.label}
                      </Text>
                      <Text className="text-muted text-xs">{Math.round((s.value / totalPlayed) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Activity breakdown */}
            <Text className="text-lg font-semibold text-ink mb-3">Your Activity</Text>
            <View className="bg-white rounded-2xl p-4 mb-6" style={CARD_SHADOW}>
              <ActivityBarRow label="Regular Games" value={regularGamesPlayed} max={activityMax} color="#2563EB" />
              <ActivityBarRow label="Tournaments" value={stats?.tournamentsPlayedTotal ?? 0} max={activityMax} color="#D97706" />
              <ActivityBarRow label="Games Hosted" value={stats?.gamesHostedTotal ?? 0} max={activityMax} color="#A21CAF" />
            </View>

            {/* Achievements */}
            <Text className="text-lg font-semibold text-ink mb-3">Achievements</Text>
            <View className="flex-row flex-wrap justify-between mb-3">
              {achievements.map((a) => (
                <AchievementBadge key={a.key} achievement={a} />
              ))}
            </View>

            {/* Active squads */}
            {stats && stats.activeSquads.length > 0 ? (
              <>
                <Text className="text-lg font-semibold text-ink mb-3">Active Squads</Text>
                {stats.activeSquads.map((s) => (
                  <EnrolledRow
                    key={s.id}
                    title={s.name}
                    subtitle="You're an active member"
                    onPress={() => navigation.navigate("SquadDetail", { squadId: s.id })}
                  />
                ))}
                <View className="h-3" />
              </>
            ) : null}

            {/* Upcoming tournaments */}
            {stats && stats.upcomingTournaments.length > 0 ? (
              <>
                <Text className="text-lg font-semibold text-ink mb-3">Upcoming Tournaments</Text>
                {stats.upcomingTournaments.map((t) => (
                  <EnrolledRow
                    key={t.id}
                    title={t.title}
                    subtitle={`${t.sportName ?? "Tournament"} · ${t.gameDate}`}
                    onPress={() => navigation.navigate("GameDetail", { gameId: t.id })}
                  />
                ))}
                <View className="h-3" />
              </>
            ) : null}

            {/* Upcoming games */}
            {stats && stats.upcomingGames.length > 0 ? (
              <>
                <Text className="text-lg font-semibold text-ink mb-3">Upcoming Games</Text>
                {stats.upcomingGames.map((g) => (
                  <EnrolledRow
                    key={g.id}
                    title={g.title}
                    subtitle={`${g.sportName ?? "Game"} · ${g.gameDate}`}
                    onPress={() => navigation.navigate("GameDetail", { gameId: g.id })}
                  />
                ))}
                <View className="h-3" />
              </>
            ) : null}
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
          onPress={async () => {
            await signOutGoogle();
            supabase.auth.signOut();
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
