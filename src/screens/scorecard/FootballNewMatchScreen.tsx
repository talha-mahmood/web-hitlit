import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateFootballMatch } from "../../hooks/useFootball";
import { friendlyFootballError } from "../../lib/api/football";
import { useLinkScorecardMatch } from "../../hooks/useTournamentMatches";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import AddPlayersFromGroupModal from "../../components/AddPlayersFromGroupModal";
import GradientFill from "../../components/GradientFill";
import { namesClash, entryCollides, hasBlockingDuplicateNames, disambiguateRoster, type NamedEntry } from "../../lib/matchNameValidation";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import SportNewMatchHeader from "../../components/SportNewMatchHeader";

// See NewMatchScreen.tsx (cricket) for why this carries a sourceId.
type PlayerEntry = NamedEntry;

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FootballNewMatch">;
type Route = RouteProp<ScorecardStackParamList, "FootballNewMatch">;

const LOCKED_FIELD_STYLE = { backgroundColor: "#F3F4F6" };

// Presets are TOTAL minutes (both halves / both extra-time periods
// combined) — the familiar way a casual match gets described ("we're
// playing a 30 minute match"). Each is split into two equal halves/periods
// when creating the match.
const MATCH_DURATION_PRESETS = ["20", "30", "40", "60", "90"];
const STANDARD_MATCH_TOTAL_MINUTES = 90;
const EXTRA_TIME_PRESETS = ["10", "20", "30"];
const STANDARD_EXTRA_TIME_TOTAL_MINUTES = 30;

function IconBadge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
    >
      <Ionicons name={icon} size={17} color={colors.primaryDark} />
    </View>
  );
}

function CardSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
      <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
        <IconBadge icon={icon} />
        <Text className="text-ink font-bold text-base">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <View className="flex-row rounded-xl px-3 py-2.5 mt-3" style={{ backgroundColor: colors.primaryLight, gap: 8 }}>
      <Ionicons name="information-circle" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
      <Text className="text-xs flex-1" style={{ color: colors.primaryDark }}>
        {text}
      </Text>
    </View>
  );
}

// Same "Add Players" chip-list pattern as cricket's NewMatchScreen — free-
// text player names (not linked to any real user), used later to attribute
// a goal to a specific player via Select a Player.
function AddPlayersField({
  players,
  onPlayersChange,
  playersLocked,
  otherTeamPlayers,
}: {
  players: PlayerEntry[];
  onPlayersChange: (players: PlayerEntry[]) => void;
  playersLocked?: boolean;
  // The sibling team's current roster — a name can't be reused across
  // teams, not just within this one.
  otherTeamPlayers: PlayerEntry[];
}) {
  const [draft, setDraft] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const addPlayer = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (entryCollides({ name: trimmed, sourceId: null }, [...players, ...otherTeamPlayers])) {
      setAddError("Someone with this name is already in the match.");
      return;
    }
    onPlayersChange([...players, { name: trimmed, sourceId: null }]);
    setDraft("");
    setAddError(null);
  };

  return (
    <>
      <Text className="text-ink font-semibold text-sm mb-2 mt-4">Players</Text>
      {!playersLocked && (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-1">
            <FieldInput
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                setAddError(null);
              }}
              placeholder="Add player name"
              onSubmitEditing={addPlayer}
              returnKeyType="done"
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />
          </View>
          <Pressable
            onPress={addPlayer}
            disabled={!draft.trim()}
          >
            {draft.trim() ? (
              <GradientFill className="w-11 h-11 rounded-xl items-center justify-center">
                <Ionicons name="add" size={20} color="white" />
              </GradientFill>
            ) : (
              <View className="w-11 h-11 rounded-xl items-center justify-center bg-gray-200">
                <Ionicons name="add" size={20} color="white" />
              </View>
            )}
          </Pressable>
        </View>
      )}
      {addError && (
        <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
          {addError}
        </Text>
      )}
      {!playersLocked && (
        <Pressable
          onPress={() => setShowGroupModal(true)}
          className="flex-row items-center justify-center rounded-xl py-2.5 mt-2.5"
          style={{ gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
        >
          <Ionicons name="people-outline" size={16} color={colors.primaryDark} />
          <Text className="text-sm font-semibold" style={{ color: colors.primaryDark }}>
            Add From a Group
          </Text>
        </Pressable>
      )}
      {players.length > 0 && (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          {players.map((p, i) => (
            <View
              key={`${p.name}-${i}`}
              className="flex-row items-center bg-primary-light rounded-full pl-3 pr-2 py-1.5"
              style={{ gap: 6 }}
            >
              <Text className="text-primary text-sm font-medium">{p.name}</Text>
              {!playersLocked && (
                <Pressable onPress={() => onPlayersChange(players.filter((_, idx) => idx !== i))} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      <AddPlayersFromGroupModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        excludedUserIds={[...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id)}
        onAdd={(picked) => onPlayersChange([...players, ...picked.map((p) => ({ name: p.name, sourceId: p.userId }))])}
      />
    </>
  );
}

export default function FootballNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const prefill = params?.prefill;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateFootballMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? "");
  // Players come pre-filled from the tournament roster and are locked, same
  // as cricket's NewMatchScreen.
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerEntry[]>(
    (prefill?.teamAPlayers ?? []).map((name) => ({ name, sourceId: null }))
  );
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerEntry[]>(
    (prefill?.teamBPlayers ?? []).map((name) => ({ name, sourceId: null }))
  );
  const [requiresWinner, setRequiresWinner] = useState<"NO" | "YES" | null>("NO");
  const [totalMatchMinutes, setTotalMatchMinutes] = useState<string | null>(String(STANDARD_MATCH_TOTAL_MINUTES));
  const [totalExtraTimeMinutes, setTotalExtraTimeMinutes] = useState<string | null>(String(STANDARD_EXTRA_TIME_TOTAL_MINUTES));
  const [venue, setVenue] = useState(prefill?.venue ?? "");

  const totalMatchNumber = parseInt(totalMatchMinutes ?? "", 10);
  const isMatchDurationValid = !!totalMatchMinutes && totalMatchNumber > 0;
  const halfDurationMinutes = isMatchDurationValid ? Math.max(1, Math.round(totalMatchNumber / 2)) : 0;
  const actualTotalMatchMinutes = halfDurationMinutes * 2;

  const needsExtraTime = requiresWinner === "YES";
  const totalExtraTimeNumber = parseInt(totalExtraTimeMinutes ?? "", 10);
  const isExtraTimeDurationValid = !needsExtraTime || (!!totalExtraTimeMinutes && totalExtraTimeNumber > 0);
  const extraTimePeriodMinutes = needsExtraTime && isExtraTimeDurationValid ? Math.max(1, Math.round(totalExtraTimeNumber / 2)) : 0;
  const actualTotalExtraTimeMinutes = extraTimePeriodMinutes * 2;

  const isValid =
    teamAName.trim().length > 0 &&
    teamBName.trim().length > 0 &&
    !namesClash(teamAName, teamBName) &&
    !hasBlockingDuplicateNames([...teamAPlayers, ...teamBPlayers]) &&
    !!requiresWinner &&
    isMatchDurationValid &&
    isExtraTimeDurationValid;

  const handleCreate = () => {
    if (!isValid || !userId || !requiresWinner) return;
    // Two different real people can share a display name (allowed when
    // picked from a group with distinct accounts) — the match row only
    // stores plain name text, so same-named entries need a disambiguating
    // suffix before saving or they'd be indistinguishable once scoring starts.
    const { teamANames, teamBNames } = disambiguateRoster(teamAPlayers, teamBPlayers);
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: teamANames,
        teamBPlayers: teamBNames,
        requiresWinner: needsExtraTime,
        halfDurationMinutes,
        // Not needed for a match that can end in a draw, but the column is
        // required — the standard 15-min period is a harmless default.
        extraTimePeriodMinutes: needsExtraTime ? extraTimePeriodMinutes : 15,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => {
          if (prefill) {
            linkScorecardMatch.mutate({ matchId: prefill.tournamentMatchId, sport: "football", scorecardMatchId: matchId });
          }
          navigation.replace("FootballLiveScoring", { matchId });
        },
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SportNewMatchHeader
        sport="football"
        title="New Football Match"
        subtitle="Kicks off immediately once created"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {prefill && (
          <InfoBox text="Team names and venue come from the tournament match and can't be changed here — everything else is up to you." />
        )}

        <CardSection icon="shirt-outline" title="Team A">
          <FieldInput
            value={teamAName}
            onChangeText={setTeamAName}
            placeholder="e.g. Strikers FC"
            maxLength={40}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
          {namesClash(teamAName, teamBName) && (
            <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
              Team A and Team B can't have the same name.
            </Text>
          )}
          <AddPlayersField players={teamAPlayers} onPlayersChange={setTeamAPlayers} playersLocked={!!prefill} otherTeamPlayers={teamBPlayers} />
        </CardSection>

        <CardSection icon="shirt-outline" title="Team B">
          <FieldInput
            value={teamBName}
            onChangeText={setTeamBName}
            placeholder="e.g. United FC"
            maxLength={40}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
          {namesClash(teamAName, teamBName) && (
            <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
              Team A and Team B can't have the same name.
            </Text>
          )}
          <AddPlayersField players={teamBPlayers} onPlayersChange={setTeamBPlayers} playersLocked={!!prefill} otherTeamPlayers={teamAPlayers} />
        </CardSection>

        <CardSection icon="location-outline" title="Venue">
          <FieldInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. City Stadium"
            maxLength={60}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
        </CardSection>

        <CardSection icon="time-outline" title="Match Duration">
          <PillRow
            options={MATCH_DURATION_PRESETS.map((n) => ({ label: n === "90" ? "90 (Standard)" : n, value: n }))}
            value={MATCH_DURATION_PRESETS.includes(totalMatchMinutes ?? "") ? totalMatchMinutes : null}
            onChange={setTotalMatchMinutes}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom total (minutes)</Text>
          <FieldInput
            value={totalMatchMinutes ?? ""}
            onChangeText={(t) => setTotalMatchMinutes(t.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="e.g. 10"
            keyboardType="number-pad"
            maxLength={3}
          />
          <InfoBox
            text={
              isMatchDurationValid
                ? `Split into two ${halfDurationMinutes}-minute halves${actualTotalMatchMinutes !== totalMatchNumber ? ` (${actualTotalMatchMinutes} min total)` : ""}.`
                : "Enter how many minutes the whole match should run — it's split evenly into two halves."
            }
          />
        </CardSection>

        <CardSection icon="trophy-outline" title="Needs a Winner?">
          <PillRow
            options={[
              { label: "No — a draw can stand", value: "NO" as const },
              { label: "Yes — extra time & penalties", value: "YES" as const },
            ]}
            value={requiresWinner}
            onChange={setRequiresWinner}
          />
          <InfoBox
            text={
              needsExtraTime
                ? `If the match is level after ${isMatchDurationValid ? actualTotalMatchMinutes : STANDARD_MATCH_TOTAL_MINUTES} minutes, you'll be offered extra time, then a penalty shootout if it's still level.`
                : `A draw after ${isMatchDurationValid ? actualTotalMatchMinutes : STANDARD_MATCH_TOTAL_MINUTES} minutes ends the match — no extra time or shootout will be offered.`
            }
          />
        </CardSection>

        {needsExtraTime && (
          <CardSection icon="timer-outline" title="Extra Time Duration">
            <PillRow
              options={EXTRA_TIME_PRESETS.map((n) => ({ label: n === "30" ? "30 (Standard)" : n, value: n }))}
              value={EXTRA_TIME_PRESETS.includes(totalExtraTimeMinutes ?? "") ? totalExtraTimeMinutes : null}
              onChange={setTotalExtraTimeMinutes}
            />
            <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom total (minutes)</Text>
            <FieldInput
              value={totalExtraTimeMinutes ?? ""}
              onChangeText={(t) => setTotalExtraTimeMinutes(t.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder="e.g. 10"
              keyboardType="number-pad"
              maxLength={3}
            />
            <InfoBox
              text={
                isExtraTimeDurationValid && extraTimePeriodMinutes > 0
                  ? `Split into two ${extraTimePeriodMinutes}-minute periods${actualTotalExtraTimeMinutes !== totalExtraTimeNumber ? ` (${actualTotalExtraTimeMinutes} min total)` : ""} if the match needs a decider.`
                  : "Enter the total extra-time length — it's split evenly into two periods, separate from the regular match duration."
              }
            />
          </CardSection>
        )}

        <Pressable
          onPress={handleCreate}
          disabled={!isValid || createMatch.isPending}
          style={isValid ? primaryButtonShadow : undefined}
        >
          {isValid ? (
            <GradientFill className="flex-row items-center justify-center rounded-2xl py-4 mt-2" style={{ gap: 8 }}>
              {createMatch.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="white" />
                  <Text className="font-bold text-base text-white">Kick Off</Text>
                </>
              )}
            </GradientFill>
          ) : (
            <View className="flex-row items-center justify-center rounded-2xl py-4 mt-2 bg-gray-200" style={{ gap: 8 }}>
              {createMatch.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color={colors.muted} />
                  <Text className="font-bold text-base text-muted">Kick Off</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
