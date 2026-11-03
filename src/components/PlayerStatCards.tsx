import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import PieChart from "./PieChart";
import { getRatingTierInfo } from "../lib/playerRating";
import { getSportIcon } from "../lib/sportIcons";
import { colors, cardShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SkeletonBlock } from "./Skeleton";

// The white stat cards shown on both the Profile screen (your own numbers) and
// a player's Top Players detail page (theirs): rating, Games Win, the stat
// grid, the sports chart + activity, sport totals, and the "Filter By Sports"
// list. Keeping them here means the two screens can't drift apart.

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


export type PlayerStatCardsData = {
  rating: number;
  gamesPlayed: number;
  tournamentsPlayed: number;
  gamesHosted: number;
  activeSquads: number;
  hoursPlayed: number;
  participationScore: number;
  followerCount: number;
  // Scored non-tournament games — the "Regular Games" activity bar.
  regularGamesPlayed: number;
  matchesWon: number;
  matchesPlayed: number;
  sportSegments: { label: string; value: number; color: string }[];
  // Cricket runs/wickets and football goals; only shown once filtered to that sport.
  totals: { runs: number; wickets: number; goals: number } | null;
};

export type SportsPlayedEntry = { sportId: string; sportName: string; count: number };

export default function PlayerStatCards({
  data,
  isLoading = false,
  filterSportId,
  filterSportName,
  sportsPlayed,
  onSelectSport,
  hideSportsFilter = false,
  onOpenSportFilter,
}: {
  data: PlayerStatCardsData;
  isLoading?: boolean;
  filterSportId?: string;
  filterSportName?: string;
  sportsPlayed: SportsPlayedEntry[];
  onSelectSport: (sportId: string, sportName: string) => void;
  // The Player Profile screen (viewing someone else) replaces this in-card
  // list with a filter icon in the hero instead — same filter, same modal,
  // just surfaced like the Top Players list does it.
  hideSportsFilter?: boolean;
  // When given, the Rating card shows the same gradient "All Sports" pill
  // Player Profile shows in its hero — tapping it should open that same
  // sport-select sheet. Used by the user's own Profile screen now that it
  // no longer shows the in-card sports list.
  onOpenSportFilter?: () => void;
}) {
  const {
    rating,
    gamesPlayed,
    tournamentsPlayed,
    gamesHosted,
    activeSquads,
    hoursPlayed,
    participationScore,
    followerCount,
    matchesWon,
    matchesPlayed,
    sportSegments,
    totals,
  } = data;
  const ratingTier = getRatingTierInfo(rating);
  const winPercentage = matchesPlayed > 0 ? Math.min(100, Math.round((matchesWon / matchesPlayed) * 100)) : 0;
  let winTag: string | null = null;
  if (matchesPlayed > 0) {
    if (winPercentage === 100) winTag = "Perfect!";
    else if (winPercentage >= 70) winTag = "Great!";
  }
  // Percentages are each sport's share of the chart's own total, so every one
  // is between 0 and 100 and together they make up the whole pie.
  const sportTotal = Math.max(1, sportSegments.reduce((sum, s) => sum + s.value, 0));

  return (
    <>
        {/* Rating card */}
        <View
          style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 16, marginBottom: 24, position: "relative" }}
        >
          <View style={{ position: "absolute", right: 14, top: 16, alignItems: "flex-end" }}>
            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: ratingTier.bg }}>
              <Text className="text-xs font-bold" style={{ color: ratingTier.color }}>
                {ratingTier.label}
              </Text>
            </View>
          </View>
          {onOpenSportFilter && (
            <Pressable onPress={onOpenSportFilter} className="self-start mb-3">
              <GradientFill className="flex-row items-center rounded-full px-3 py-1" style={{ gap: 5 }}>
                <Text className="text-xs font-bold text-white" numberOfLines={1}>
                  {filterSportName ?? "All Sports"}
                </Text>
                <Ionicons name="chevron-down" size={13} color="white" />
              </GradientFill>
            </Pressable>
          )}
          <Text className="text-xs font-bold mb-2" style={{ letterSpacing: 0.5, color: colors.muted }}>
            Rating
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
              <Text className="text-ink font-extrabold" style={{ fontSize: 25, lineHeight: 29 }}>
                {rating}
              </Text>
              <Ionicons name="star" size={16} color="#FACC15" style={{ marginTop: -13 }} />
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
        </View>

        {isLoading ? (
          <View className="flex-row mb-6" style={{ gap: 12 }}>
            <SkeletonBlock height={88} borderRadius={16} style={{ flex: 1 }} />
            <SkeletonBlock height={88} borderRadius={16} style={{ flex: 1 }} />
          </View>
        ) : (
          <>
            {/* Games Win + Followers — two compact cards side by side, right under the rating card */}
            <View className="flex-row items-stretch mb-6" style={{ gap: 12 }}>
              <View
                style={{ flex: 1, backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14 }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 34, height: 34, backgroundColor: "#DCEFE4" }}
                  >
                    <Ionicons name="locate" size={17} color="#1D9254" />
                  </View>
                  <View className="items-end">
                    <Text className="text-ink font-extrabold text-base">{winPercentage}%</Text>
                    {winTag && (
                      <View className="rounded-full px-2 py-0.5 mt-0.5" style={{ backgroundColor: "#F3F4F6" }}>
                        <Text className="text-[10px] font-bold text-ink">{winTag}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text className="text-ink font-extrabold text-xl">
                  {matchesWon} / {matchesPlayed}
                </Text>
                <Text className="text-xs mt-0.5 mb-2" style={{ color: colors.muted }} numberOfLines={1}>
                  {filterSportName ? `Games Win · ${filterSportName}` : "Games Win"}
                </Text>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", marginTop: "auto" }}>
                  <GradientFill style={{ height: 6, borderRadius: 3, width: `${winPercentage}%` }} />
                </View>
              </View>

              <View
                style={{ flex: 1, backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14 }}
              >
                <View className="mb-2">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 34, height: 34, backgroundColor: "#EFF6FF" }}
                  >
                    <Ionicons name="people" size={17} color="#2563EB" />
                  </View>
                </View>
                <Text className="text-ink font-extrabold text-xl">{followerCount}</Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>
                  Followers
                </Text>
              </View>
            </View>

            {/* Stat grid */}
            <View className="flex-row flex-wrap justify-between mb-6" style={{ rowGap: 12 }}>
              <StatCard icon="football-outline" bg="#EFF6FF" fg="#2563EB" value={gamesPlayed} label="Games Played" />
              <StatCard icon="trophy-outline" bg="#FFFBEB" fg="#D97706" value={tournamentsPlayed} label="Tournaments Played" />
              <StatCard icon="star-outline" bg="#FFF1F2" fg="#E11D48" value={gamesHosted} label="Games Hosted" />
              <StatCard icon="people-outline" bg="#DCEFE4" fg="#1D9254" value={activeSquads} label="Active Groups" />
              <StatCard icon="time-outline" bg="#EFF6FF" fg="#2563EB" value={hoursPlayed} label="Hours Played" />
              <StatCard icon="pulse-outline" bg="#F5F3FF" fg="#7C3AED" value={participationScore} label="Participation Score" />
            </View>

            {/* Sport breakdown — now the only card in this row, full width
                after removing the "Your Activity" card beside it. */}
            <View
              className="mb-6"
              style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14, position: "relative" }}
            >
              <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                <Ionicons name="pie-chart" size={15} color={colors.primary} />
                <Text className="text-ink font-semibold" numberOfLines={1}>
                  Sports Played
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

            {/* Sport-specific totals — only once filtered to that one sport.
                Cricket has its own dedicated Statistics tab once selected, so
                no redundant runs/wickets card here. */}
            {totals && filterSportName?.toLowerCase() === "football" && (
              <View
                  style={{ backgroundColor: "white", ...cardShadow, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, backgroundColor: "#DCEFE4" }}
                  >
                    <MaterialCommunityIcons name="soccer" size={22} color="#1D9254" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink font-extrabold text-xl">{totals.goals}</Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>Total Goals</Text>
                  </View>
                </View>
            )}

            {/* Sports Played — tap one to filter Games Win and the sport totals above */}
            {!hideSportsFilter && sportsPlayed.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-ink">Filter By Sports</Text>
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
                        onPress={() => onSelectSport(sp.sportId, sp.sportName)}
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

    </>
  );
}
