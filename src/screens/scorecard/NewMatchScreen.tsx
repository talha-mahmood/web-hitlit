import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateCricketMatch } from "../../hooks/useCricket";
import { friendlyCricketError } from "../../lib/api/cricket";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "NewMatch">;

function PlayerListEditor({
  teamLabel,
  players,
  onChange,
}: {
  teamLabel: string;
  players: string[];
  onChange: (players: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addPlayer = () => {
    const name = draft.trim();
    if (!name) return;
    onChange([...players, name]);
    setDraft("");
  };

  return (
    <View className="mt-5">
      <SectionLabel title={`${teamLabel} Players`} required />
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View className="flex-1">
          <FieldInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Player name"
            onSubmitEditing={addPlayer}
            returnKeyType="done"
          />
        </View>
        <Pressable
          onPress={addPlayer}
          disabled={!draft.trim()}
          className={`w-11 h-11 rounded-xl items-center justify-center ${draft.trim() ? "bg-primary" : "bg-gray-200"}`}
        >
          <Ionicons name="add" size={20} color="white" />
        </Pressable>
      </View>
      {players.length > 0 && (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          {players.map((name, i) => (
            <View
              key={`${name}-${i}`}
              className="flex-row items-center bg-primary-light rounded-full pl-3 pr-2 py-1.5"
              style={{ gap: 6 }}
            >
              <Text className="text-primary text-sm font-medium">{name}</Text>
              <Pressable onPress={() => onChange(players.filter((_, idx) => idx !== i))} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function NewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateCricketMatch();

  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>([]);
  const [oversLimit, setOversLimit] = useState<string | null>(null);
  const [tossWinner, setTossWinner] = useState<"A" | "B" | null>(null);
  const [tossDecision, setTossDecision] = useState<"BAT" | "BOWL" | null>(null);

  const isValid =
    teamAName.trim().length > 0 &&
    teamBName.trim().length > 0 &&
    teamAPlayers.length >= 2 &&
    teamBPlayers.length >= 2 &&
    !!oversLimit &&
    parseInt(oversLimit, 10) > 0 &&
    !!tossWinner &&
    !!tossDecision;

  const handleCreate = () => {
    if (!isValid || !userId || !oversLimit || !tossWinner || !tossDecision) return;
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers,
        teamBPlayers,
        oversLimit: parseInt(oversLimit, 10),
        tossWinner,
        tossDecision,
      },
      {
        onSuccess: ({ matchId }) => navigation.replace("LiveScoring", { matchId }),
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-100"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border bg-white"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">New Match</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionLabel title="Team A Name" required />
        <FieldInput value={teamAName} onChangeText={setTeamAName} placeholder="e.g. Strikers" maxLength={40} />
        <PlayerListEditor teamLabel="Team A" players={teamAPlayers} onChange={setTeamAPlayers} />

        <View className="mt-6 pt-6 border-t border-border">
          <SectionLabel title="Team B Name" required />
          <FieldInput value={teamBName} onChangeText={setTeamBName} placeholder="e.g. Warriors" maxLength={40} />
          <PlayerListEditor teamLabel="Team B" players={teamBPlayers} onChange={setTeamBPlayers} />
        </View>

        <View className="mt-6 pt-6 border-t border-border">
          <SectionLabel title="Overs per Innings" required />
          <FieldInput
            value={oversLimit ?? ""}
            onChangeText={(t) => setOversLimit(t.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="e.g. 20"
            keyboardType="number-pad"
            maxLength={3}
          />

          <SectionLabel title="Toss Winner" required />
          <PillRow
            options={[
              { label: teamAName.trim() || "Team A", value: "A" as const },
              { label: teamBName.trim() || "Team B", value: "B" as const },
            ]}
            value={tossWinner}
            onChange={setTossWinner}
          />

          <SectionLabel title="Toss Decision" required />
          <PillRow
            options={[
              { label: "Bat", value: "BAT" as const },
              { label: "Bowl", value: "BOWL" as const },
            ]}
            value={tossDecision}
            onChange={setTossDecision}
          />
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={!isValid || createMatch.isPending}
          className={`rounded-xl py-4 items-center mt-8 ${isValid ? "bg-primary" : "bg-gray-200"}`}
          style={isValid ? primaryButtonShadow : undefined}
        >
          {createMatch.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`font-semibold text-base ${isValid ? "text-white" : "text-muted"}`}>
              Start Match
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
