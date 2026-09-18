import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreatePadelMatch } from "../../hooks/usePadel";
import { friendlyPadelError } from "../../lib/api/padel";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { MatchFormat, DeuceType, Team } from "../../lib/padelScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "PadelNewMatch">;

const FORMAT_OPTIONS: { label: string; value: MatchFormat }[] = [
  { label: "Best of 1 Set", value: "BEST_OF_1" },
  { label: "Best of 3 Sets", value: "BEST_OF_3" },
  { label: "Best of 3 + Match Tiebreak", value: "BEST_OF_3_MATCH_TIEBREAK" },
];

const FORMAT_INFO: Record<MatchFormat, string> = {
  BEST_OF_1: "A single set decides the match.",
  BEST_OF_3: "First pair to win 2 full sets wins the match.",
  BEST_OF_3_MATCH_TIEBREAK:
    "First to win 2 sets wins. If it's 1-1, the decider is a single 10-point Match Tiebreak (win by 2) instead of a third set — the FIP Beyond format.",
};

const DEUCE_OPTIONS: { label: string; value: DeuceType }[] = [
  { label: "Advantage", value: "ADVANTAGE" },
  { label: "Golden Point", value: "GOLDEN_POINT" },
  { label: "Star Point", value: "STAR_POINT" },
];

const DEUCE_INFO: Record<DeuceType, string> = {
  ADVANTAGE: "Traditional scoring — at 40-40, a pair must win two points in a row to take the game.",
  GOLDEN_POINT: "At 40-40, the very next point wins the game outright — no advantage.",
  STAR_POINT:
    "2026 FIP rule — at 40-40, two rounds of Deuce/Advantage are played; a third deuce becomes a single decisive Star Point.",
};

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

// Padel is doubles — a team card takes exactly two player slots (a singles
// match can still be scored by leaving the second slot blank).
function TeamCard({
  letter,
  name,
  onNameChange,
  players,
  onPlayersChange,
}: {
  letter: "A" | "B";
  name: string;
  onNameChange: (v: string) => void;
  players: [string, string];
  onPlayersChange: (players: [string, string]) => void;
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
        <Text className="text-ink font-bold text-sm flex-1">Team {letter}</Text>
      </View>

      <View className="px-4 pt-4 pb-4">
        <Text className="text-ink font-semibold text-sm mb-2">
          Team {letter} Name <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput value={name} onChangeText={onNameChange} placeholder={letter === "A" ? "e.g. Smashers" : "e.g. Net Ninjas"} maxLength={40} />

        <Text className="text-ink font-semibold text-sm mb-2 mt-4">
          Player 1 <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput
          value={players[0]}
          onChangeText={(v) => onPlayersChange([v, players[1]])}
          placeholder="e.g. Alex"
          maxLength={40}
          left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
        />

        <Text className="text-ink font-semibold text-sm mb-2 mt-4">Player 2</Text>
        <FieldInput
          value={players[1]}
          onChangeText={(v) => onPlayersChange([players[0], v])}
          placeholder="e.g. Sam (optional for singles)"
          maxLength={40}
          left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
        />
      </View>
    </View>
  );
}

export default function PadelNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreatePadelMatch();

  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [teamAPlayers, setTeamAPlayers] = useState<[string, string]>(["", ""]);
  const [teamBPlayers, setTeamBPlayers] = useState<[string, string]>(["", ""]);
  const [format, setFormat] = useState<MatchFormat | null>("BEST_OF_3");
  const [deuceType, setDeuceType] = useState<DeuceType | null>("ADVANTAGE");
  const [firstServerTeam, setFirstServerTeam] = useState<Team | null>(null);
  const [firstServerPlayerIndex, setFirstServerPlayerIndex] = useState<0 | 1 | null>(null);
  const [venue, setVenue] = useState("");

  const teamAValidPlayers = teamAPlayers.filter((p) => p.trim().length > 0);
  const teamBValidPlayers = teamBPlayers.filter((p) => p.trim().length > 0);
  const serverTeamPlayers = firstServerTeam === "A" ? teamAPlayers : firstServerTeam === "B" ? teamBPlayers : ["", ""];

  const isValid =
    teamAName.trim().length > 0 &&
    teamBName.trim().length > 0 &&
    teamAValidPlayers.length > 0 &&
    teamBValidPlayers.length > 0 &&
    !!format &&
    !!deuceType &&
    !!firstServerTeam &&
    firstServerPlayerIndex !== null;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !deuceType || !firstServerTeam || firstServerPlayerIndex === null) return;
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: teamAValidPlayers,
        teamBPlayers: teamBValidPlayers,
        format,
        deuceType,
        firstServerTeam,
        firstServerPlayerIndex,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => navigation.replace("PadelLiveScoring", { matchId }),
        onError: (err) => Alert.alert("Error", friendlyPadelError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="px-4 flex-row items-center" style={{ paddingTop: insets.top + 16, paddingBottom: 16, gap: 6 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">New Padel Match</Text>
          <Text className="text-muted text-sm mt-0.5">Set up teams and match rules</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} players={teamAPlayers} onPlayersChange={setTeamAPlayers} />
        <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} players={teamBPlayers} onPlayersChange={setTeamBPlayers} />

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChangeText={setVenue} placeholder="e.g. Padel Club Karachi" maxLength={60} />
        </CardSection>

        <CardSection icon="trophy-outline" title="Match Format">
          <PillRow options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
          {format && <InfoBox text={FORMAT_INFO[format]} />}
        </CardSection>

        <CardSection icon="albums-outline" title="Deuce Rule">
          <PillRow options={DEUCE_OPTIONS} value={deuceType} onChange={setDeuceType} />
          {deuceType && <InfoBox text={DEUCE_INFO[deuceType]} />}
        </CardSection>

        <CardSection icon="tennisball-outline" title="First Server">
          <Text className="text-muted text-xs font-semibold mb-2">Serving Team</Text>
          <PillRow
            options={[
              { label: teamAName.trim() || "Team A", value: "A" as const },
              { label: teamBName.trim() || "Team B", value: "B" as const },
            ]}
            value={firstServerTeam}
            onChange={(v) => {
              setFirstServerTeam(v);
              setFirstServerPlayerIndex(null);
            }}
          />
          {firstServerTeam && (
            <>
              <Text className="text-muted text-xs font-semibold mb-2 mt-4">Serving Player</Text>
              <PillRow
                options={([0, 1] as const)
                  .filter((i) => serverTeamPlayers[i].trim().length > 0)
                  .map((i) => ({ label: serverTeamPlayers[i].trim(), value: String(i) as "0" | "1" }))}
                value={firstServerPlayerIndex === null ? null : (String(firstServerPlayerIndex) as "0" | "1")}
                onChange={(v) => setFirstServerPlayerIndex(v === "0" ? 0 : 1)}
              />
            </>
          )}
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
