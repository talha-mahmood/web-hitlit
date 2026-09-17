import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateCricketMatch } from "../../hooks/useCricket";
import { friendlyCricketError } from "../../lib/api/cricket";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "NewMatch">;

const OVERS_PRESETS = ["2", "5", "10", "20", "50"];

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
  required?: boolean;
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

function TeamCard({
  letter,
  players,
  name,
  onNameChange,
  onPlayersChange,
}: {
  letter: "A" | "B";
  players: string[];
  name: string;
  onNameChange: (v: string) => void;
  onPlayersChange: (players: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addPlayer = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onPlayersChange([...players, trimmed]);
    setDraft("");
  };

  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4" style={cardShadow}>
      <View
        className="flex-row items-center px-4 py-3"
        style={{ gap: 10, backgroundColor: colors.primaryLight }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 30, height: 30, backgroundColor: colors.primary }}
        >
          <Text className="text-white font-extrabold text-sm">{letter}</Text>
        </View>
        <Ionicons name="shirt-outline" size={18} color={colors.primaryDark} />
        <View className="flex-1">
          <Text className="text-ink font-bold text-sm">Team {letter}</Text>
          <Text className="text-muted text-xs">Enter team name and players</Text>
        </View>
        <View
          className="flex-row items-center rounded-full px-2.5 py-1"
          style={{ gap: 4, backgroundColor: "white" }}
        >
          <Ionicons name="people" size={12} color={colors.primaryDark} />
          <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
            {players.length} player{players.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View className="px-4 pt-4 pb-4">
        <Text className="text-ink font-semibold text-sm mb-2">
          Team {letter} Name <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput
          value={name}
          onChangeText={onNameChange}
          placeholder={letter === "A" ? "e.g. Strikers" : "e.g. Warriors"}
          maxLength={40}
          right={
            name.length > 0 ? (
              <Pressable onPress={() => onNameChange("")} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />

        <Text className="text-ink font-semibold text-sm mb-2 mt-4">
          Team {letter} Players <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-1">
            <FieldInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add player name"
              onSubmitEditing={addPlayer}
              returnKeyType="done"
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
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
            {players.map((p, i) => (
              <View
                key={`${p}-${i}`}
                className="flex-row items-center bg-primary-light rounded-full pl-3 pr-2 py-1.5"
                style={{ gap: 6 }}
              >
                <Text className="text-primary text-sm font-medium">{p}</Text>
                <Pressable onPress={() => onPlayersChange(players.filter((_, idx) => idx !== i))} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
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
  const [venue, setVenue] = useState("");

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
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => navigation.replace("LiveScoring", { matchId }),
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-green-50" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View className="overflow-hidden" style={{ paddingTop: insets.top + 16, paddingBottom: 16 }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: colors.primaryLight,
            opacity: 0.5,
            top: -110,
            right: -60,
          }}
        />

        {/* Grass mound — a big circle peeking up from the bottom-right
            corner, cheaper than a real grass silhouette but reads the same
            at this size. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: "#4ADE80",
            bottom: -230,
            right: -70,
          }}
        />

        {/* Stumps: three tan bars with two bails resting on top. */}
        <View pointerEvents="none" style={{ position: "absolute", right: 74, bottom: 8, flexDirection: "row" }}>
          <View style={{ position: "absolute", top: -5, left: 1, width: 15, height: 4, borderRadius: 2, backgroundColor: "#C9A46B" }} />
          <View style={{ position: "absolute", top: -5, left: 15, width: 15, height: 4, borderRadius: 2, backgroundColor: "#C9A46B" }} />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 7,
                height: 62,
                marginLeft: i === 0 ? 0 : 7,
                borderRadius: 3,
                backgroundColor: "#C9A46B",
              }}
            />
          ))}
        </View>

        {/* Ball, overlapping the stumps at their base. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 34,
            bottom: 14,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#DC2626",
            borderWidth: 1,
            borderColor: "#991B1B",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 15,
              left: -4,
              width: 42,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.75)",
              transform: [{ rotate: "-18deg" }],
            }}
          />
        </View>

        <View className="flex-row items-center px-4" style={{ gap: 6 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">New Match</Text>
            <Text className="text-muted text-sm mt-0.5">Setup your match details and start scoring</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} players={teamAPlayers} onPlayersChange={setTeamAPlayers} />
        <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} players={teamBPlayers} onPlayersChange={setTeamBPlayers} />

        <CardSection icon="location-outline" title="Venue">
          <FieldInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. Karachi Cricket Ground"
            maxLength={60}
          />
        </CardSection>

        <CardSection icon="baseball-outline" title="Overs per Innings">
          <PillRow
            options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))}
            value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null}
            onChange={setOversLimit}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom number</Text>
          <FieldInput
            value={oversLimit ?? ""}
            onChangeText={(t) => setOversLimit(t.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="e.g. 15"
            keyboardType="number-pad"
            maxLength={3}
          />
        </CardSection>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <CardSection icon="trophy-outline" title="Toss Winner">
              <PillRow
                options={[
                  { label: teamAName.trim() || "Team A", value: "A" as const },
                  { label: teamBName.trim() || "Team B", value: "B" as const },
                ]}
                value={tossWinner}
                onChange={setTossWinner}
              />
            </CardSection>
          </View>
          <View className="flex-1">
            <CardSection icon="albums-outline" title="Toss Decision">
              <PillRow
                options={[
                  { label: "Bat", value: "BAT" as const },
                  { label: "Bowl", value: "BOWL" as const },
                ]}
                value={tossDecision}
                onChange={setTossDecision}
              />
            </CardSection>
          </View>
        </View>

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
