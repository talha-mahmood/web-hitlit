import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
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
import AddPlayersFromGroupModal from "../../components/AddPlayersFromGroupModal";
import { namesClash, entryCollides, hasBlockingDuplicateNames, disambiguateRoster, type NamedEntry } from "../../lib/matchNameValidation";
import type { MatchFormat, PlayMode, Player } from "../../lib/tennisScoring";

// See NewMatchScreen.tsx (cricket) for why this carries a sourceId — only
// used for the doubles Player 1/Player 2 slots here, since the singles
// Name field (also used as the doubles team label) stays plain text.
type PlayerEntry = NamedEntry;
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import SportNewMatchHeader from "../../components/SportNewMatchHeader";

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
  otherTeamName,
  otherTeamPlayers,
}: {
  letter: "A" | "B";
  name: string;
  onNameChange: (v: string) => void;
  playMode: PlayMode;
  players: [PlayerEntry, PlayerEntry];
  onPlayersChange: (players: [PlayerEntry, PlayerEntry]) => void;
  serverIndex: 0 | 1;
  onServerIndexChange: (v: 0 | 1) => void;
  locked?: boolean;
  // The sibling team's current name/roster — a name can't be reused across
  // teams, not just within this one.
  otherTeamName: string;
  otherTeamPlayers: [PlayerEntry, PlayerEntry];
}) {
  const isDoubles = playMode === "DOUBLES";
  const [showGroupModal, setShowGroupModal] = useState(false);
  const emptySlotCount = players.filter((p) => !p.name.trim()).length;
  const teamNameClash = namesClash(name, otherTeamName);
  const slot0Duplicate = isDoubles && !!players[0].name.trim() && entryCollides(players[0], [players[1], ...otherTeamPlayers]);
  const slot1Duplicate = isDoubles && !!players[1].name.trim() && entryCollides(players[1], [players[0], ...otherTeamPlayers]);

  const handleAddFromGroup = (picked: { userId: string; name: string }[]) => {
    const next: [PlayerEntry, PlayerEntry] = [...players];
    let i = 0;
    for (let slot = 0; slot < 2 && i < picked.length; slot++) {
      if (!next[slot].name.trim()) {
        next[slot] = { name: picked[i].name, sourceId: picked[i].userId };
        i++;
      }
    }
    onPlayersChange(next);
  };

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
        {teamNameClash && (
          <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
            {isDoubles ? "Team A and Team B can't have the same name." : "Player A and Player B can't have the same name."}
          </Text>
        )}
        {!isDoubles && !locked && (
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

        {isDoubles && (
          <>
            <Text className="text-ink font-semibold text-sm mb-2 mt-4">
              Player 1 <Text className="text-red-500">*</Text>
            </Text>
            <FieldInput
              value={players[0].name}
              onChangeText={(v) => onPlayersChange([{ name: v, sourceId: null }, players[1]])}
              placeholder="e.g. Alex"
              maxLength={40}
              editable={!locked}
              containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />
            {slot0Duplicate && (
              <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
                Someone with this name is already in the match.
              </Text>
            )}
            <Text className="text-ink font-semibold text-sm mb-2 mt-4">
              Player 2 <Text className="text-red-500">*</Text>
            </Text>
            <FieldInput
              value={players[1].name}
              onChangeText={(v) => onPlayersChange([players[0], { name: v, sourceId: null }])}
              placeholder="e.g. Jo"
              maxLength={40}
              editable={!locked}
              containerStyle={locked ? LOCKED_FIELD_STYLE : undefined}
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />
            {slot1Duplicate && (
              <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
                Someone with this name is already in the match.
              </Text>
            )}
            {!locked && emptySlotCount > 0 && (
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

            <Text className="text-ink font-semibold text-sm mb-2 mt-4">Serves for {name.trim() || `Team ${letter}`}</Text>
            <PillRow
              options={([0, 1] as const)
                .filter((i) => players[i].name.trim().length > 0)
                .map((i) => ({ label: players[i].name.trim(), value: String(i) as "0" | "1" }))}
              value={String(serverIndex) as "0" | "1"}
              onChange={(v) => onServerIndexChange(v === "0" ? 0 : 1)}
            />
          </>
        )}
      </View>

      <AddPlayersFromGroupModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        excludedUserIds={isDoubles ? [...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id) : []}
        maxSelect={isDoubles ? emptySlotCount : 1}
        onAdd={(picked) => (isDoubles ? handleAddFromGroup(picked) : onNameChange(picked[0].name))}
      />
    </View>
  );
}

export default function TennisNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const prefill = params?.prefill;
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
  const [playerAPlayers, setPlayerAPlayers] = useState<[PlayerEntry, PlayerEntry]>([
    { name: prefill?.teamAPlayers[0] ?? "", sourceId: null },
    { name: prefill?.teamAPlayers[1] ?? "", sourceId: null },
  ]);
  const [playerBPlayers, setPlayerBPlayers] = useState<[PlayerEntry, PlayerEntry]>([
    { name: prefill?.teamBPlayers[0] ?? "", sourceId: null },
    { name: prefill?.teamBPlayers[1] ?? "", sourceId: null },
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
    (playerAPlayers[0].name.trim().length > 0 &&
      playerAPlayers[1].name.trim().length > 0 &&
      playerBPlayers[0].name.trim().length > 0 &&
      playerBPlayers[1].name.trim().length > 0);

  const gamesPerSetNumber = parseInt(gamesPerSet ?? "", 10);
  const isGamesPerSetValid = !!gamesPerSet && gamesPerSetNumber > 0;

  const isValid =
    playerAName.trim().length > 0 &&
    playerBName.trim().length > 0 &&
    !namesClash(playerAName, playerBName) &&
    doublesPlayersValid &&
    (!isDoubles || !hasBlockingDuplicateNames([...playerAPlayers, ...playerBPlayers])) &&
    !!playMode &&
    !!format &&
    !!firstServer &&
    isGamesPerSetValid;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !firstServer || !playMode) return;
    // Two different real people can share a display name (allowed when
    // picked from a group with distinct accounts) — the match row only
    // stores plain name text, so same-named entries need a disambiguating
    // suffix before saving or they'd be indistinguishable once scoring starts.
    const { teamANames: disambiguatedA, teamBNames: disambiguatedB } = disambiguateRoster(
      playerAPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId })),
      playerBPlayers.map((p) => ({ name: p.name.trim(), sourceId: p.sourceId }))
    );
    createMatch.mutate(
      {
        userId,
        playerAName: playerAName.trim(),
        playerBName: playerBName.trim(),
        playerAPlayers: isDoubles ? disambiguatedA.filter(Boolean) : [],
        playerBPlayers: isDoubles ? disambiguatedB.filter(Boolean) : [],
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
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SportNewMatchHeader
        sport="tennis"
        title="New Tennis Match"
        subtitle="Set up players and match rules"
        onBack={() => navigation.goBack()}
      />

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
              otherTeamName={playerBName}
              otherTeamPlayers={playerBPlayers}
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
              otherTeamName={playerAName}
              otherTeamPlayers={playerAPlayers}
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
