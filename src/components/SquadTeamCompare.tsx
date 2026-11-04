import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import FieldInput from "./FieldInput";
import { useSquads } from "../hooks/useSquads";
import { useMyOwnedSquads } from "../hooks/useSquadTeamFill";
import { useAuthStore } from "../store/authStore";
import { useSquadCricketMatches } from "../hooks/useSquadCricketStats";
import { usePlayerGenericFigures } from "./PlayerSportOverview";
import { computeSquadFigures, squadTeamOverviewStats, squadRosterAggregates } from "../lib/squadCricketStats";
import { aggregateGeneric, classifySportKind } from "../lib/genericSportStats";
import type { SquadDetail, SquadListItem } from "../lib/api/squads";

type Mode = "COMPARE" | "HEAD_TO_HEAD";

function PickTeamModal({
  visible,
  onClose,
  excludeSquadId,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  excludeSquadId: string;
  onPick: (s: { id: string; name: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [search, setSearch] = useState("");
  const { data: searchResults, isLoading: searching } = useSquads(search.trim() ? { search: search.trim() } : {});
  const { data: myTeams, isLoading: myTeamsLoading } = useMyOwnedSquads(userId);

  const results: SquadListItem[] = search.trim()
    ? (searchResults ?? []).filter((s) => s.group_type === "team" && s.id !== excludeSquadId)
    : (myTeams ?? []).filter((s) => s.group_type === "team" && s.id !== excludeSquadId);
  const loading = search.trim() ? searching : myTeamsLoading;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ maxHeight: "80%", paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink">Select a Team</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <FieldInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search a team"
            left={<Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
          />
          {!search.trim() && <Text className="text-muted text-xs mt-3 mb-1">My Teams</Text>}
          {loading ? (
            <ActivityIndicator color={colors.primary} className="mt-6" />
          ) : results.length === 0 ? (
            <Text className="text-muted text-sm text-center mt-6">No teams found.</Text>
          ) : (
            <View className="mt-3" style={{ gap: 8 }}>
              {results.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    onPick({ id: s.id, name: s.name });
                    onClose();
                  }}
                  className="flex-row items-center border border-border rounded-xl px-3 py-2.5"
                  style={{ gap: 10 }}
                >
                  <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                    <Text className="text-primary font-bold text-xs">{s.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CompareBar({ label, valueA, valueB, leaderA, leaderB }: { label: string; valueA: string | number; valueB: string | number; leaderA?: string; leaderB?: string }) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center">
        <Text className="font-bold text-sm flex-1" style={{ color: colors.primaryDark }}>{valueA}</Text>
        <Text className="text-muted text-xs font-bold">{label}</Text>
        <Text className="font-bold text-sm flex-1 text-right" style={{ color: colors.primaryDark }}>{valueB}</Text>
      </View>
      {(leaderA || leaderB) && (
        <View className="flex-row mt-1">
          <Text className="text-muted text-xs flex-1" numberOfLines={1}>{leaderA ?? ""}</Text>
          <Text className="text-muted text-xs flex-1 text-right" numberOfLines={1}>{leaderB ?? ""}</Text>
        </View>
      )}
    </View>
  );
}

function CricketCompareView({ squad, other }: { squad: SquadDetail; other: { id: string; name: string } }) {
  const { data: matchesA, isLoading: loadingA } = useSquadCricketMatches(squad.name, squad.sport_id);
  const { data: matchesB, isLoading: loadingB } = useSquadCricketMatches(other.name, squad.sport_id);

  if (loadingA || loadingB) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  const figuresA = computeSquadFigures(matchesA ?? [], squad.name);
  const figuresB = computeSquadFigures(matchesB ?? [], other.name);
  const statsA = squadTeamOverviewStats(figuresA);
  const statsB = squadTeamOverviewStats(figuresB);

  const namesA = squad.squad_members.filter((m) => m.status === "ACTIVE").map((m) => m.profiles?.full_name).filter((n): n is string => !!n);
  const rosterA = squadRosterAggregates(matchesA ?? [], namesA);
  const leaderA = [...rosterA].sort((a, b) => b.batting.runs - a.batting.runs)[0];
  const leaderBowlA = [...rosterA].sort((a, b) => b.bowling.wickets - a.bowling.wickets)[0];

  return (
    <View className="mt-4">
      <View className="flex-row justify-between mb-5">
        <Text className="text-ink font-extrabold text-base flex-1" numberOfLines={1}>{squad.name.toUpperCase()}</Text>
        <Text className="text-ink font-extrabold text-base flex-1 text-right" numberOfLines={1}>{other.name.toUpperCase()}</Text>
      </View>
      <CompareBar label="Matches" valueA={statsA.matches} valueB={statsB.matches} />
      <CompareBar label="Won" valueA={statsA.won} valueB={statsB.won} />
      <CompareBar label="Lost" valueA={statsA.lost} valueB={statsB.lost} />
      <CompareBar label="Win %" valueA={`${statsA.winPercent.toFixed(1)}`} valueB={`${statsB.winPercent.toFixed(1)}`} />
      <CompareBar label="High Score" valueA={statsA.highScore} valueB={statsB.highScore} />
      <CompareBar label="Low Score" valueA={statsA.lowScore} valueB={statsB.lowScore} />
      <Text className="text-ink font-bold text-sm text-center mt-2 mb-3">Most Runs</Text>
      <CompareBar label="" valueA={leaderA?.batting.runs ?? 0} valueB={0} leaderA={leaderA?.name} />
      <Text className="text-ink font-bold text-sm text-center mt-2 mb-3">Most Wickets</Text>
      <CompareBar label="" valueA={leaderBowlA?.bowling.wickets ?? 0} valueB={0} leaderA={leaderBowlA?.name} />
    </View>
  );
}

function GenericCompareView({ squad, other, sport }: { squad: SquadDetail; other: { id: string; name: string }; sport: ReturnType<typeof classifySportKind> & {} }) {
  const kind = sport as Exclude<ReturnType<typeof classifySportKind>, "cricket" | null>;
  const { data: figuresA, isLoading: loadingA } = usePlayerGenericFigures(kind, squad.name);
  const { data: figuresB, isLoading: loadingB } = usePlayerGenericFigures(kind, other.name);
  if (loadingA || loadingB) return <ActivityIndicator color={colors.primary} className="mt-10" />;
  const statsA = aggregateGeneric(figuresA ?? []);
  const statsB = aggregateGeneric(figuresB ?? []);
  return (
    <View className="mt-4">
      <View className="flex-row justify-between mb-5">
        <Text className="text-ink font-extrabold text-base flex-1" numberOfLines={1}>{squad.name.toUpperCase()}</Text>
        <Text className="text-ink font-extrabold text-base flex-1 text-right" numberOfLines={1}>{other.name.toUpperCase()}</Text>
      </View>
      <CompareBar label="Matches" valueA={statsA.matches} valueB={statsB.matches} />
      <CompareBar label="Won" valueA={statsA.wins} valueB={statsB.wins} />
      <CompareBar label="Lost" valueA={statsA.losses} valueB={statsB.losses} />
      <CompareBar label="Win %" valueA={statsA.winPercent.toFixed(1)} valueB={statsB.winPercent.toFixed(1)} />
    </View>
  );
}

function HeadToHeadView({ squad, other }: { squad: SquadDetail; other: { id: string; name: string } }) {
  const sportKind = classifySportKind(squad.sports?.name);
  const isCricket = sportKind === "cricket";
  const { data: matches, isLoading: cricketLoading } = useSquadCricketMatches(isCricket ? squad.name : null, squad.sport_id);
  const { data: genericFigures, isLoading: genericLoading } = usePlayerGenericFigures(
    sportKind && sportKind !== "cricket" ? sportKind : null,
    sportKind && sportKind !== "cricket" ? squad.name : null
  );

  if (isCricket ? cricketLoading : genericLoading) return <ActivityIndicator color={colors.primary} className="mt-10" />;

  if (isCricket) {
    const figures = computeSquadFigures(matches ?? [], squad.name).filter(
      (f) => f.opponentTeamName.trim().toLowerCase() === other.name.trim().toLowerCase()
    );
    if (figures.length === 0) {
      return <Text className="text-muted text-sm text-center mt-10">These teams have not faced each other in any matches.</Text>;
    }
    const stats = squadTeamOverviewStats(figures);
    return (
      <View className="mt-4" style={{ gap: 10 }}>
        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
            <Text className="font-bold text-base">{stats.matches}</Text>
            <Text className="text-muted text-xs mt-0.5">Matches</Text>
          </View>
          <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
            <Text className="font-bold text-base">{stats.won}</Text>
            <Text className="text-muted text-xs mt-0.5">{squad.name} Won</Text>
          </View>
          <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
            <Text className="font-bold text-base">{stats.lost}</Text>
            <Text className="text-muted text-xs mt-0.5">{other.name} Won</Text>
          </View>
        </View>
      </View>
    );
  }

  const figures = (genericFigures ?? []).filter((f) => f.opponentName.trim().toLowerCase() === other.name.trim().toLowerCase());
  if (figures.length === 0) {
    return <Text className="text-muted text-sm text-center mt-10">These teams have not faced each other in any matches.</Text>;
  }
  const stats = aggregateGeneric(figures);
  return (
    <View className="mt-4 flex-row" style={{ gap: 10 }}>
      <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
        <Text className="font-bold text-base">{stats.matches}</Text>
        <Text className="text-muted text-xs mt-0.5">Matches</Text>
      </View>
      <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
        <Text className="font-bold text-base">{stats.wins}</Text>
        <Text className="text-muted text-xs mt-0.5">{squad.name} Won</Text>
      </View>
      <View className="flex-1 items-center py-3 rounded-xl" style={{ backgroundColor: "#F3F4F6" }}>
        <Text className="font-bold text-base">{stats.losses}</Text>
        <Text className="text-muted text-xs mt-0.5">{other.name} Won</Text>
      </View>
    </View>
  );
}

export default function SquadTeamCompare({ squad }: { squad: SquadDetail }) {
  const [mode, setMode] = useState<Mode>("COMPARE");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [other, setOther] = useState<{ id: string; name: string } | null>(null);
  const sportKind = classifySportKind(squad.sports?.name);
  const isCricket = sportKind === "cricket";

  return (
    <View className="mt-4">
      <Pressable onPress={() => setPickerOpen(true)} className="flex-row items-center justify-center rounded-xl border border-dashed border-border py-3 mb-4">
        <Ionicons name="people-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
        <Text className="text-muted font-semibold text-sm">{other ? `Comparing with ${other.name}` : "Select one of my teams"}</Text>
      </Pressable>

      <View className="flex-row rounded-xl overflow-hidden mb-4" style={{ backgroundColor: "#F3F4F6" }}>
        {(["COMPARE", "HEAD_TO_HEAD"] as Mode[]).map((m) =>
          mode === m ? (
            <Pressable key={m} onPress={() => setMode(m)} className="flex-1">
              <GradientFill className="items-center py-2.5">
                <Text className="text-white font-bold text-xs">{m === "COMPARE" ? "COMPARE" : "HEAD TO HEAD"}</Text>
              </GradientFill>
            </Pressable>
          ) : (
            <Pressable key={m} onPress={() => setMode(m)} className="flex-1 items-center py-2.5">
              <Text className="font-bold text-xs" style={{ color: "#6B7280" }}>{m === "COMPARE" ? "COMPARE" : "HEAD TO HEAD"}</Text>
            </Pressable>
          )
        )}
      </View>

      {!other ? (
        <Text className="text-muted text-sm text-center mt-6">Search a team to compare or select one of your teams.</Text>
      ) : mode === "COMPARE" ? (
        isCricket ? (
          <CricketCompareView squad={squad} other={other} />
        ) : (
          <GenericCompareView squad={squad} other={other} sport={sportKind as never} />
        )
      ) : (
        <HeadToHeadView squad={squad} other={other} />
      )}

      <PickTeamModal visible={pickerOpen} onClose={() => setPickerOpen(false)} excludeSquadId={squad.id} onPick={setOther} />
    </View>
  );
}
