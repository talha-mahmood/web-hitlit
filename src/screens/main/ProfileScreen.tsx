import { useCallback, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, Modal, Alert, BackHandler, RefreshControl } from "react-native";
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
import PlayerStatCards from "../../components/PlayerStatCards";
import JerseyNumberCard from "../../components/JerseyNumberCard";
import SelectSportModal from "../../components/SelectSportModal";
import { useSports } from "../../hooks/useSports";
import { getSportIcon } from "../../lib/sportIcons";
import PlayerCricketOverview, { usePlayerCricketFigures } from "../../components/PlayerCricketOverview";
import PlayerCricketStatistics from "../../components/PlayerCricketStatistics";
import PlayerCricketMatches from "../../components/PlayerCricketMatches";
import PlayerCricketTeams from "../../components/PlayerCricketTeams";
import PlayerCricketTournaments from "../../components/PlayerCricketTournaments";
import PlayerCricketClubs from "../../components/PlayerCricketClubs";
import PlayerCricketInsights from "../../components/PlayerCricketInsights";
import PlayerCricketCompare from "../../components/PlayerCricketCompare";
import PlayerSportOverview, { usePlayerGenericFigures } from "../../components/PlayerSportOverview";
import PlayerSportStatistics from "../../components/PlayerSportStatistics";
import PlayerSportMatches from "../../components/PlayerSportMatches";
import PlayerSportTeams from "../../components/PlayerSportTeams";
import PlayerSportTournaments from "../../components/PlayerSportTournaments";
import PlayerSportClubs from "../../components/PlayerSportClubs";
import PlayerSportInsights from "../../components/PlayerSportInsights";
import PlayerSportCompare from "../../components/PlayerSportCompare";
import { classifySportKind, type GenericSport } from "../../lib/genericSportStats";
import type { ProfileTab } from "../../screens/players/PlayerProfileScreen";
import GradientFill from "../../components/GradientFill";
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
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: allSports } = useSports();
  // Every card below (rating, stat grid, sports chart, activity, Games Win)
  // follows the selected sport, so they're all fetched narrowed to it.
  const { data: stats, isLoading, refetch, isRefetching } = useProfileStats(userId, filterSportId);
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
  const { data: cricketFigures } = usePlayerCricketFigures(player?.fullName);
  const hasCricketData = !!cricketFigures && cricketFigures.length > 0;
  // Same tab-set resolution PlayerProfileScreen uses when viewing someone
  // else's profile — the Overview/Statistics/etc. tabs only ever show once a
  // specific sport is explicitly filtered to; "All Sports" shows no tabs,
  // same as any other sport with no stats module.
  const resolvedSportKind: "cricket" | GenericSport | null = filterSportName
    ? classifySportKind(filterSportName)
    : null;
  const genericSport: GenericSport | null = resolvedSportKind && resolvedSportKind !== "cricket" ? resolvedSportKind : null;
  const { data: genericFigures } = usePlayerGenericFigures(genericSport, player?.fullName);
  const hasGenericData = !!genericFigures && genericFigures.length > 0;
  const hasActiveSportData = resolvedSportKind === "cricket" ? hasCricketData : resolvedSportKind ? hasGenericData : false;
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
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

  const regularGamesPlayed = stats?.regularGamesPlayedTotal ?? 0;

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
      <GradientFill
        style={{
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
                className="w-16 h-16 rounded-full bg-primary-light"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center">
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
              <GradientFill
                className="absolute bottom-0 right-0 items-center justify-center rounded-full"
                style={{ width: 24, height: 24, borderWidth: 2, borderColor: "white" }}
              >
                <Ionicons name="camera" size={12} color="white" />
              </GradientFill>
            )}
          </Pressable>
          <View className="flex-1 mr-2">
            <View className="flex-row items-center" style={{ gap: 6 }}>
              {/* flexShrink on both the text and its row — without it, the
                  name renders at its full natural width regardless of how
                  little room is left, pushing the checkmark (and this whole
                  row) out past the header into the settings button. */}
              <Text
                className="text-white font-bold flex-shrink"
                style={{ flexShrink: 1, fontSize: 19 }}
                numberOfLines={1}
              >
                {profile?.full_name ?? "Profile"}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color="#4ADE80" style={{ flexShrink: 0 }} />
            </View>
            <Pressable onPress={handleCopyUserId} className="flex-row items-center mt-1" style={{ gap: 4 }} hitSlop={6}>
              <Ionicons name="pricetag-outline" size={12} color="white" />
              <Text style={{ color: "white" }} className="text-sm" numberOfLines={1}>
                ID: {profile?.user_code ?? "—"}
              </Text>
              <Ionicons name={userIdCopied ? "checkmark" : "copy-outline"} size={12} color="white" />
            </Pressable>
            {profile?.created_at ? (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="calendar-outline" size={12} color="white" />
                <Text style={{ color: "white" }} className="text-xs">Member since {formatMonthYear(profile.created_at)}</Text>
              </View>
            ) : null}
            {(followState?.followerCount ?? 0) > 0 && (
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <Ionicons name="people-outline" size={12} color="white" />
                <Text style={{ color: "white" }} className="text-xs">
                  {followState!.followerCount} follower{followState!.followerCount === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => navigation.navigate("AccountSettings")}
            className="items-center justify-center bg-white rounded-full"
            style={{ width: 40, height: 40, ...CARD_SHADOW }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primaryDark} />
          </Pressable>
        </View>
      </GradientFill>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
      {hasActiveSportData && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-grow-0"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}
        >
          {(
            [
              ["profile", "Player Profile"],
              ["overview", "Player Overview"],
              ["statistics", "Statistics"],
              ["matches", "Matches"],
              ["teams", "Teams"],
              ["tournaments", "Tournaments"],
              ["clubs", "Clubs"],
              ["insights", "Insights"],
              ["compare", "Compare"],
            ] as [ProfileTab, string][]
          ).map(([key, label]) =>
            activeTab === key ? (
              <Pressable key={key} onPress={() => setActiveTab(key)}>
                <GradientFill className="rounded-full px-4 py-2">
                  <Text className="text-xs font-bold text-white">{label}</Text>
                </GradientFill>
              </Pressable>
            ) : (
              <Pressable
                key={key}
                onPress={() => setActiveTab(key)}
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: "#E5E7EB" }}
              >
                <Text className="text-xs font-bold" style={{ color: "#374151" }}>
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </ScrollView>
      )}

      <View className="px-6" style={{ paddingTop: hasActiveSportData ? 16 : 20 }}>
        {activeTab !== "profile" && resolvedSportKind === "cricket" && player?.fullName ? (
          <>
            {activeTab === "overview" && <PlayerCricketOverview fullName={player.fullName} />}
            {activeTab === "statistics" && <PlayerCricketStatistics fullName={player.fullName} />}
            {activeTab === "matches" && <PlayerCricketMatches fullName={player.fullName} />}
            {activeTab === "teams" && <PlayerCricketTeams fullName={player.fullName} />}
            {activeTab === "tournaments" && <PlayerCricketTournaments fullName={player.fullName} />}
            {activeTab === "clubs" && userId && <PlayerCricketClubs userId={userId} />}
            {activeTab === "insights" && <PlayerCricketInsights fullName={player.fullName} />}
            {activeTab === "compare" && <PlayerCricketCompare fullName={player.fullName} displayName={player.fullName} />}
          </>
        ) : activeTab !== "profile" && genericSport && player?.fullName ? (
          <>
            {activeTab === "overview" && <PlayerSportOverview sport={genericSport} fullName={player.fullName} />}
            {activeTab === "statistics" && <PlayerSportStatistics sport={genericSport} fullName={player.fullName} />}
            {activeTab === "matches" && <PlayerSportMatches sport={genericSport} fullName={player.fullName} />}
            {activeTab === "teams" && <PlayerSportTeams sport={genericSport} fullName={player.fullName} />}
            {activeTab === "tournaments" && <PlayerSportTournaments sport={genericSport} fullName={player.fullName} />}
            {activeTab === "clubs" && userId && <PlayerSportClubs sport={genericSport} userId={userId} />}
            {activeTab === "insights" && <PlayerSportInsights sport={genericSport} fullName={player.fullName} />}
            {activeTab === "compare" && (
              <PlayerSportCompare sport={genericSport} fullName={player.fullName} displayName={player.fullName} />
            )}
          </>
        ) : (
          <PlayerStatCards
            data={{
              rating,
              gamesPlayed: stats?.gamesPlayedTotal ?? 0,
              tournamentsPlayed: stats?.tournamentsPlayedTotal ?? 0,
              gamesHosted: stats?.gamesHostedTotal ?? 0,
              activeSquads: stats?.activeSquads.length ?? 0,
              hoursPlayed: stats?.hoursPlayedTotal ?? 0,
              participationScore: computeRating(stats),
              followerCount: followState?.followerCount ?? 0,
              regularGamesPlayed,
              matchesWon,
              matchesPlayed,
              sportSegments,
              totals: player ? { runs: player.totalRuns, wickets: player.totalWickets, goals: player.totalGoals } : null,
            }}
            isLoading={isLoading}
            filterSportId={filterSportId}
            filterSportName={filterSportName}
            sportsPlayed={sportsPlayed}
            onSelectSport={handleSelectSportCard}
            hideSportsFilter
            onOpenSportFilter={() => setSportSheetOpen(true)}
          />
        )}

        <SelectSportModal
          visible={sportSheetOpen}
          onClose={() => setSportSheetOpen(false)}
          sports={allSports ?? []}
          selectedSportId={filterSportId}
          onApply={(id) => {
            const match = id ? (allSports ?? []).find((s) => s.id === id) : undefined;
            setFilterSportId(id);
            setFilterSportName(match?.name);
            setSportSheetOpen(false);
          }}
        />

        {profile?.jersey_number != null && <JerseyNumberCard number={profile.jersey_number} />}

        <Pressable
          onPress={async () => {
            await signOutGoogle();
            signOutWithPushCleanup();
          }}
        >
          <GradientFill className="rounded-xl py-4 items-center mt-2">
            <Text className="text-white font-semibold" style={{ fontSize: 17 }}>Sign out</Text>
          </GradientFill>
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
