import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateTennisMatch } from "../../hooks/useTennis";
import { friendlyTennisError } from "../../lib/api/tennis";
import { useLinkScorecardMatch } from "../../hooks/useTournamentMatches";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { MatchFormat, PlayMode, Player } from "../../lib/tennisScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TennisNewMatch">;
type Route = RouteProp<ScorecardStackParamList, "TennisNewMatch">;

const LOCKED_FIELD_STYLE = { backgroundColor: "#F3F4F6" };

const FORMAT_OPTIONS: { label: string; value: MatchFormat }[] = [
  { label: "Best of 1 Set", value: "BEST_OF_1" },
  { label: "Best of 3 Sets", value: "BEST_OF_3" },
  { label: "Best of 5 Sets", value: "BEST_OF_5" },
];

const FORMAT_INFO: Record<MatchFormat, string> = {
  BEST_OF_1: "A single set decides the match.",
  BEST_OF_3: "First player to win 2 sets wins the match.",
  BEST_OF_5: "First player to win 3 sets wins the match.",
};

const GAMES_PER_SET_PRESETS = ["3", "4", "6"];
const STANDARD_GAMES_PER_SET = 6;

const PLAY_MODE_OPTIONS: { label: string; value: PlayMode }[] = [
  { label: "Singles", value: "SINGLES" },
  { label: "Doubles", value: "DOUBLES" },
];

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
  const isDoubles = playMode === "DOUBLES";
  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4" style={cardShadow}>
      <View className="flex-row items-center px-4 py-3" style={{ gap: 10, backgroundColor: colors.primaryLight }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 30, height: 30, backgroundColor: colors.primary }}
        >
          <Text className="text-white font-extrabold text-sm">{letter}</Text>
        </View>
        <Text className="text-ink font-bold text-sm flex-1">{isDoubles ? `Team ${letter}` : `Player ${letter}`}</Text>
      </View>

      <View className="px-4 pt-4 pb-4">
        <Text className="text-ink font-semibold text-sm mb-2">
          {isDoubles ? `Team ${letter} Name` : `Player ${letter} Name`} <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput
          value={name}
          onChangeText={onNameChange}
          placeholder={letter === "A" ? "e.g. Alex" : "e.g. Sam"}
          maxLength={40}
          editable={!locked}
          containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
        />

        {isDoubles && (
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

export default function TennisNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const prefill = params?.prefill;
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateTennisMatch();
  const linkScorecardMatch = useLinkScorecardMatch(prefill?.gameId ?? "");

  // When prefilled, team/player fields are locked to the tournament
  // roster — so Doubles can only be offered as a choice if that roster
  // actually has 2 real players per side. Otherwise there'd be no way to
  // fill the (locked, blank) second player slot Doubles requires.
  const canOfferDoubles = !prefill || (prefill.teamAPlayers.length >= 2 && prefill.teamBPlayers.length >= 2);
  const playModeOptions = canOfferDoubles ? PLAY_MODE_OPTIONS : PLAY_MODE_OPTIONS.filter((o) => o.value !== "DOUBLES");
  const [playMode, setPlayMode] = useState<PlayMode | null>(prefill && canOfferDoubles ? "DOUBLES" : "SINGLES");
  const [playerAName, setPlayerAName] = useState(prefill?.teamAName ?? "");
  const [playerBName, setPlayerBName] = useState(prefill?.teamBName ?? "");
  const [playerAPlayers, setPlayerAPlayers] = useState<[string, string]>([
    prefill?.teamAPlayers[0] ?? "",
    prefill?.teamAPlayers[1] ?? "",
  ]);
  const [playerBPlayers, setPlayerBPlayers] = useState<[string, string]>([
    prefill?.teamBPlayers[0] ?? "",
    prefill?.teamBPlayers[1] ?? "",
  ]);
  const [playerAServerIndex, setPlayerAServerIndex] = useState<0 | 1>(0);
  const [playerBServerIndex, setPlayerBServerIndex] = useState<0 | 1>(0);
  const [format, setFormat] = useState<MatchFormat | null>("BEST_OF_3");
  const [firstServer, setFirstServer] = useState<Player | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? "");
  const [gamesPerSet, setGamesPerSet] = useState<string | null>(String(STANDARD_GAMES_PER_SET));

  const isDoubles = playMode === "DOUBLES";
  const doublesPlayersValid =
    !isDoubles ||
    (playerAPlayers[0].trim().length > 0 &&
      playerAPlayers[1].trim().length > 0 &&
      playerBPlayers[0].trim().length > 0 &&
      playerBPlayers[1].trim().length > 0);

  const gamesPerSetNumber = parseInt(gamesPerSet ?? "", 10);
  const isGamesPerSetValid = !!gamesPerSet && gamesPerSetNumber > 0;

  const isValid =
    playerAName.trim().length > 0 &&
    playerBName.trim().length > 0 &&
    doublesPlayersValid &&
    !!playMode &&
    !!format &&
    !!firstServer &&
    isGamesPerSetValid;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !firstServer || !playMode) return;
    createMatch.mutate(
      {
        userId,
        playerAName: playerAName.trim(),
        playerBName: playerBName.trim(),
        playerAPlayers: isDoubles ? playerAPlayers.map((p) => p.trim()).filter(Boolean) : [],
        playerBPlayers: isDoubles ? playerBPlayers.map((p) => p.trim()).filter(Boolean) : [],
        format,
        firstServer,
        gamesPerSet: gamesPerSetNumber,
        playMode,
        playerAServerIndex: isDoubles ? playerAServerIndex : 0,
        playerBServerIndex: isDoubles ? playerBServerIndex : 0,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => {
          if (prefill) {
            linkScorecardMatch.mutate({ matchId: prefill.tournamentMatchId, sport: "tennis", scorecardMatchId: matchId });
          }
          navigation.replace("TennisLiveScoring", { matchId });
        },
        onError: (err) => Alert.alert("Error", friendlyTennisError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="px-4 flex-row items-center" style={{ paddingTop: insets.top + 16, paddingBottom: 16, gap: 6 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">New Tennis Match</Text>
          <Text className="text-muted text-sm mt-0.5">Set up players and match rules</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {prefill && (
          <InfoBox text="Team/player names and venue come from the tournament match and can't be changed here — everything else is up to you." />
        )}

        <CardSection icon="people-outline" title="Play Mode">
          <PillRow options={playModeOptions} value={playMode} onChange={setPlayMode} />
          {!canOfferDoubles && (
            <InfoBox text="Doubles isn't available here — this tournament team only has one registered player." />
          )}
        </CardSection>

        {playMode && (
          <>
            <TeamCard
              letter="A"
              name={playerAName}
              onNameChange={setPlayerAName}
              playMode={playMode}
              players={playerAPlayers}
              onPlayersChange={setPlayerAPlayers}
              serverIndex={playerAServerIndex}
              onServerIndexChange={setPlayerAServerIndex}
              locked={!!prefill}
            />
            <TeamCard
              letter="B"
              name={playerBName}
              onNameChange={setPlayerBName}
              playMode={playMode}
              players={playerBPlayers}
              onPlayersChange={setPlayerBPlayers}
              serverIndex={playerBServerIndex}
              onServerIndexChange={setPlayerBServerIndex}
              locked={!!prefill}
            />
          </>
        )}

        <CardSection icon="location-outline" title="Venue">
          <FieldInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. Tennis Club Karachi"
            maxLength={60}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
        </CardSection>

        <CardSection icon="trophy-outline" title="Match Format">
          <PillRow options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
          {format && <InfoBox text={FORMAT_INFO[format]} />}
        </CardSection>

        <CardSection icon="flag-outline" title="Games Per Set">
          <PillRow
            options={GAMES_PER_SET_PRESETS.map((n) => ({ label: n === String(STANDARD_GAMES_PER_SET) ? `${n} (Standard)` : n, value: n }))}
            value={GAMES_PER_SET_PRESETS.includes(gamesPerSet ?? "") ? gamesPerSet : null}
            onChange={setGamesPerSet}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom target</Text>
          <FieldInput
            value={gamesPerSet ?? ""}
            onChangeText={(t) => setGamesPerSet(t.replace(/[^0-9]/g, "").slice(0, 2))}
            placeholder="e.g. 6"
            keyboardType="number-pad"
            maxLength={2}
          />
          <InfoBox
            text={
              isGamesPerSetValid
                ? `First to ${gamesPerSetNumber} games, win by 2 clear, wins the set — tiebreak at ${gamesPerSetNumber}-${gamesPerSetNumber}.`
                : "Enter how many games win a set."
            }
          />
        </CardSection>

        <CardSection icon="tennisball-outline" title={isDoubles ? "First Serving Team" : "First Server"}>
          <PillRow
            options={[
              { label: playerAName.trim() || (isDoubles ? "Team A" : "Player A"), value: "A" as const },
              { label: playerBName.trim() || (isDoubles ? "Team B" : "Player B"), value: "B" as const },
            ]}
            value={firstServer}
            onChange={setFirstServer}
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
