import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateBadmintonMatch } from "../../hooks/useBadminton";
import { friendlyBadmintonError } from "../../lib/api/badminton";
import { useLinkScorecardMatch } from "../../hooks/useTournamentMatches";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { PlayMode, Team } from "../../lib/badmintonScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import SportNewMatchHeader from "../../components/SportNewMatchHeader";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "BadmintonNewMatch">;
type Route = RouteProp<ScorecardStackParamList, "BadmintonNewMatch">;

const LOCKED_FIELD_STYLE = { backgroundColor: "#F3F4F6" };

const PLAY_MODE_OPTIONS: { label: string; value: PlayMode }[] = [
  { label: "Singles", value: "SINGLES" },
  { label: "Doubles", value: "DOUBLES" },
];

const POINTS_TO_WIN_PRESETS = ["11", "15", "21"];
const STANDARD_POINTS_TO_WIN = 21;
const GAMES_TO_WIN_PRESETS = [
  { label: "Best of 1", value: "1" },
  { label: "Best of 3", value: "2" },
  { label: "Best of 5", value: "3" },
];
const STANDARD_GAMES_TO_WIN = 2;

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

function TeamCard({
  letter,
  name,
  onNameChange,
  playMode,
  players,
  onPlayersChange,
  serverIndex,
  onServerIndexChange,
  locked,
}: {
  letter: "A" | "B";
  name: string;
  onNameChange: (v: string) => void;
  playMode: PlayMode;
  players: [string, string];
  onPlayersChange: (players: [string, string]) => void;
  serverIndex: 0 | 1;
  onServerIndexChange: (v: 0 | 1) => void;
  locked?: boolean;
}) {
  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4" style={cardShadow}>
      <View className="flex-row items-center px-4 py-3" style={{ gap: 10, backgroundColor: colors.primaryLight }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 30, height: 30, backgroundColor: colors.primary }}
        >
          <Text className="text-white font-extrabold text-sm">{letter}</Text>
        </View>
        <Text className="text-ink font-bold text-sm flex-1">{playMode === "DOUBLES" ? `Team ${letter}` : `Player ${letter}`}</Text>
      </View>

      <View className="px-4 pt-4 pb-4">
        <Text className="text-ink font-semibold text-sm mb-2">
          {playMode === "DOUBLES" ? `Team ${letter} Name` : `Player ${letter} Name`} <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput
          value={name}
          onChangeText={onNameChange}
          placeholder={letter === "A" ? "e.g. Alex" : "e.g. Sam"}
          maxLength={40}
          editable={!locked}
          containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
        />

        {playMode === "DOUBLES" && (
          <>
            <Text className="text-ink font-semibold text-sm mb-2 mt-4">
              Player 1 <Text className="text-red-500">*</Text>
            </Text>
            <FieldInput
              value={players[0]}
              onChangeText={(v) => onPlayersChange([v, players[1]])}
              placeholder="e.g. Alex"
              maxLength={40}
              editable={!locked}
              containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />
            <Text className="text-ink font-semibold text-sm mb-2 mt-4">
              Player 2 <Text className="text-red-500">*</Text>
            </Text>
            <FieldInput
              value={players[1]}
              onChangeText={(v) => onPlayersChange([players[0], v])}
              placeholder="e.g. Jo"
              maxLength={40}
              editable={!locked}
              containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />

            <Text className="text-ink font-semibold text-sm mb-2 mt-4">Serves for {name.trim() || `Team ${letter}`}</Text>
            <PillRow
              options={([0, 1] as const)
                .filter((i) => players[i].trim().length > 0)
                .map((i) => ({ label: players[i].trim(), value: String(i) as "0" | "1" }))}
              value={String(serverIndex) as "0" | "1"}
              onChange={(v) => onServerIndexChange(v === "0" ? 0 : 1)}
            />
          </>
        )}
      </View>
    </View>
  );
}

export default function BadmintonNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const prefill = params?.prefill;
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateBadmintonMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? "");
  const [teamAPlayers, setTeamAPlayers] = useState<[string, string]>([
    prefill?.teamAPlayers[0] ?? "",
    prefill?.teamAPlayers[1] ?? "",
  ]);
  const [teamBPlayers, setTeamBPlayers] = useState<[string, string]>([
    prefill?.teamBPlayers[0] ?? "",
    prefill?.teamBPlayers[1] ?? "",
  ]);
  const [teamAServerIndex, setTeamAServerIndex] = useState<0 | 1>(0);
  const [teamBServerIndex, setTeamBServerIndex] = useState<0 | 1>(0);
  // When prefilled, team/player fields are locked to the tournament
  // roster — so Doubles can only be offered as a choice if that roster
  // actually has 2 real players per side. Otherwise there'd be no way to
  // fill the (locked, blank) second player slot Doubles requires.
  const canOfferDoubles = !prefill || (prefill.teamAPlayers.length >= 2 && prefill.teamBPlayers.length >= 2);
  const playModeOptions = canOfferDoubles ? PLAY_MODE_OPTIONS : PLAY_MODE_OPTIONS.filter((o) => o.value !== "DOUBLES");
  const [playMode, setPlayMode] = useState<PlayMode | null>(canOfferDoubles ? "DOUBLES" : "SINGLES");
  const [firstServingTeam, setFirstServingTeam] = useState<Team | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? "");
  const [pointsToWin, setPointsToWin] = useState<string | null>(String(STANDARD_POINTS_TO_WIN));
  const [gamesToWin, setGamesToWin] = useState<string | null>(String(STANDARD_GAMES_TO_WIN));

  const isDoubles = playMode === "DOUBLES";
  const doublesPlayersValid =
    !isDoubles || (teamAPlayers[0].trim().length > 0 && teamAPlayers[1].trim().length > 0 && teamBPlayers[0].trim().length > 0 && teamBPlayers[1].trim().length > 0);

  const pointsToWinNumber = parseInt(pointsToWin ?? "", 10);
  const isPointsToWinValid = !!pointsToWin && pointsToWinNumber > 0;
  const gamesToWinNumber = parseInt(gamesToWin ?? "", 10);
  const isGamesToWinValid = !!gamesToWin && gamesToWinNumber > 0;

  const isValid =
    teamAName.trim().length > 0 &&
    teamBName.trim().length > 0 &&
    doublesPlayersValid &&
    !!playMode &&
    !!firstServingTeam &&
    isPointsToWinValid &&
    isGamesToWinValid;

  const handleCreate = () => {
    if (!isValid || !userId || !playMode || !firstServingTeam) return;
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: isDoubles ? teamAPlayers.map((p) => p.trim()).filter(Boolean) : [],
        teamBPlayers: isDoubles ? teamBPlayers.map((p) => p.trim()).filter(Boolean) : [],
        playMode,
        firstServingTeam,
        teamAServerIndex,
        teamBServerIndex,
        pointsToWin: pointsToWinNumber,
        gamesToWin: gamesToWinNumber,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => {
          if (prefill) {
            linkScorecardMatch.mutate({ matchId: prefill.tournamentMatchId, sport: "badminton", scorecardMatchId: matchId });
          }
          navigation.replace("BadmintonLiveScoring", { matchId });
        },
        onError: (err) => Alert.alert("Error", friendlyBadmintonError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SportNewMatchHeader
        sport="badminton"
        title="New Badminton Match"
        subtitle="Set up players and match rules"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {prefill && (
          <InfoBox text="Team/player names and venue come from the tournament match and can't be changed here — everything else is up to you." />
        )}

        <CardSection icon="people-outline" title="Play Mode">
          <PillRow
            options={playModeOptions}
            value={playMode}
            onChange={(v) => {
              setPlayMode(v);
              setFirstServingTeam(null);
            }}
          />
          {!canOfferDoubles && (
            <InfoBox text="Doubles isn't available here — this tournament team only has one registered player." />
          )}
        </CardSection>

        {playMode && (
          <>
            <TeamCard
              letter="A"
              name={teamAName}
              onNameChange={setTeamAName}
              playMode={playMode}
              players={teamAPlayers}
              onPlayersChange={setTeamAPlayers}
              serverIndex={teamAServerIndex}
              onServerIndexChange={setTeamAServerIndex}
              locked={!!prefill}
            />
            <TeamCard
              letter="B"
              name={teamBName}
              onNameChange={setTeamBName}
              playMode={playMode}
              players={teamBPlayers}
              onPlayersChange={setTeamBPlayers}
              serverIndex={teamBServerIndex}
              onServerIndexChange={setTeamBServerIndex}
              locked={!!prefill}
            />
          </>
        )}

        <CardSection icon="location-outline" title="Venue">
          <FieldInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. Badminton Court Karachi"
            maxLength={60}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
        </CardSection>

        <CardSection icon="flag-outline" title="Points To Win a Game">
          <PillRow
            options={POINTS_TO_WIN_PRESETS.map((n) => ({ label: n === String(STANDARD_POINTS_TO_WIN) ? `${n} (Standard)` : n, value: n }))}
            value={POINTS_TO_WIN_PRESETS.includes(pointsToWin ?? "") ? pointsToWin : null}
            onChange={setPointsToWin}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom target</Text>
          <FieldInput
            value={pointsToWin ?? ""}
            onChangeText={(t) => setPointsToWin(t.replace(/[^0-9]/g, "").slice(0, 2))}
            placeholder="e.g. 21"
            keyboardType="number-pad"
            maxLength={2}
          />
          <InfoBox
            text={
              isPointsToWinValid
                ? `First to ${pointsToWinNumber} points, win by 2 clear (capped at ${pointsToWinNumber + 9}), wins the game.`
                : "Enter how many points win a game."
            }
          />
        </CardSection>

        <CardSection icon="trophy-outline" title="Match Length">
          <PillRow options={GAMES_TO_WIN_PRESETS} value={GAMES_TO_WIN_PRESETS.some((o) => o.value === gamesToWin) ? gamesToWin : null} onChange={setGamesToWin} />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom games-to-win</Text>
          <FieldInput
            value={gamesToWin ?? ""}
            onChangeText={(t) => setGamesToWin(t.replace(/[^0-9]/g, "").slice(0, 1))}
            placeholder="e.g. 2"
            keyboardType="number-pad"
            maxLength={1}
          />
          <InfoBox
            text={
              isGamesToWinValid
                ? `First to win ${gamesToWinNumber} game${gamesToWinNumber === 1 ? "" : "s"} (best of ${gamesToWinNumber * 2 - 1}) wins the match.`
                : "Enter how many games are needed to win the match."
            }
          />
        </CardSection>

        <CardSection icon="tennisball-outline" title={isDoubles ? "First Serving Team" : "First Server"}>
          <PillRow
            options={[
              { label: teamAName.trim() || (isDoubles ? "Team A" : "Player A"), value: "A" as const },
              { label: teamBName.trim() || (isDoubles ? "Team B" : "Player B"), value: "B" as const },
            ]}
            value={firstServingTeam}
            onChange={setFirstServingTeam}
          />
        </CardSection>

        <Pressable
          onPress={handleCreate}
          disabled={!isValid || createMatch.isPending}
          className={`flex-row items-center justify-center rounded-2xl py-4 mt-2 ${isValid ? "bg-primary" : "bg-gray-200"}`}
          style={{ gap: 8, ...(isValid ? primaryButtonShadow : undefined) }}
        >
          {createMatch.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="play" size={16} color={isValid ? "white" : colors.muted} />
              <Text className={`font-bold text-base ${isValid ? "text-white" : "text-muted"}`}>Start Match</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
