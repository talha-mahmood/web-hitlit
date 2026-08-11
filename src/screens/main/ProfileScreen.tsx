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

function getParticipationLevel(totalPlayed: number): { label: string; color: string; bg: string } {
  if (totalPlayed >= 50) return { label: "Elite", color: "#B45309", bg: "#FFFBEB" };
  if (totalPlayed >= 25) return { label: "Veteran", color: "#7C3AED", bg: "#F5F3FF" };
  if (totalPlayed >= 10) return { label: "Enthusiast", color: "#0891B2", bg: "#ECFEFF" };
  if (totalPlayed >= 3) return { label: "Regular", color: "#16A34A", bg: "#F0FDF4" };
  return { label: "Newcomer", color: "#6B7280", bg: "#F3F4F6" };
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
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
      className="bg-white rounded-2xl p-4"
      style={{
        width: "48%",
        borderWidth: 1,
        borderColor: "rgba(17, 24, 39, 0.06)",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
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
  const participation = getParticipationLevel(totalPlayed);

  const sportSegments = (stats?.sportBreakdown ?? []).map((s) => ({
    label: s.sportName,
    value: s.count,
    color: getSportIcon(s.sportName).fg,
  }));

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
        <View className="flex-row items-center mb-4">
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

        {/* Badges */}
        <View className="flex-row mb-6" style={{ gap: 8 }}>
          <Pressable
            onPress={() => setSkillPickerOpen(true)}
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{ backgroundColor: colors.primaryLight, gap: 6 }}
          >
            <Ionicons name="medal-outline" size={14} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark }} className="text-xs font-semibold">
              {effectiveSkillLevel
                ? effectiveSkillLevel.charAt(0).toUpperCase() + effectiveSkillLevel.slice(1)
                : "Set skill level"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.primaryDark} />
          </Pressable>
          <View
            className="flex-row items-center rounded-full px-3 py-1.5"
            style={{ backgroundColor: participation.bg, gap: 6 }}
          >
            <Ionicons name="flame-outline" size={14} color={participation.color} />
            <Text style={{ color: participation.color }} className="text-xs font-semibold">
              {participation.label}
            </Text>
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
              <StatCard icon="star-outline" bg="#FDF4FF" fg="#A21CAF" value={stats?.gamesHostedTotal ?? 0} label="Games Hosted" />
              <StatCard icon="people-outline" bg="#F0FDF4" fg="#16A34A" value={stats?.activeSquads.length ?? 0} label="Active Squads" />
              <StatCard icon="time-outline" bg="#ECFEFF" fg="#0891B2" value={stats?.hoursPlayedTotal ?? 0} label="Hours Played" />
              <StatCard icon="heart-outline" bg="#FFF1F2" fg="#E11D48" value={stats?.favoriteVenuesCount ?? 0} label="Favorite Venues" />
            </View>

            {/* Sport breakdown donut */}
            <Text className="text-lg font-semibold text-ink mb-3">Sports You Play</Text>
            {sportSegments.length === 0 ? (
              <View className="border border-border rounded-2xl p-6 items-center mb-6">
                <Ionicons name="bar-chart-outline" size={28} color={colors.muted} />
                <Text className="text-muted text-sm mt-2 text-center">
                  Play your first game to see your sport breakdown here.
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center mb-6" style={{ gap: 20 }}>
                <DonutChart
                  segments={sportSegments}
                  centerLabel={String(totalPlayed)}
                  centerSubLabel="Games"
                />
                <View className="flex-1" style={{ gap: 8 }}>
                  {sportSegments.map((s) => (
                    <View key={s.label} className="flex-row items-center" style={{ gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                      <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                        {s.label}
                      </Text>
                      <Text className="text-muted text-xs">
                        {Math.round((s.value / totalPlayed) * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

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
