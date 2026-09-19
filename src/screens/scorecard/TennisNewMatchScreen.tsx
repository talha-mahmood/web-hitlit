import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateTennisMatch } from "../../hooks/useTennis";
import { friendlyTennisError } from "../../lib/api/tennis";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { MatchFormat, Player } from "../../lib/tennisScoring";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "TennisNewMatch">;

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

export default function TennisNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateTennisMatch();

  const [playerAName, setPlayerAName] = useState("");
  const [playerBName, setPlayerBName] = useState("");
  const [format, setFormat] = useState<MatchFormat | null>("BEST_OF_3");
  const [firstServer, setFirstServer] = useState<Player | null>(null);
  const [venue, setVenue] = useState("");
  const [gamesPerSet, setGamesPerSet] = useState<string | null>(String(STANDARD_GAMES_PER_SET));

  const gamesPerSetNumber = parseInt(gamesPerSet ?? "", 10);
  const isGamesPerSetValid = !!gamesPerSet && gamesPerSetNumber > 0;

  const isValid =
    playerAName.trim().length > 0 && playerBName.trim().length > 0 && !!format && !!firstServer && isGamesPerSetValid;

  const handleCreate = () => {
    if (!isValid || !userId || !format || !firstServer) return;
    createMatch.mutate(
      {
        userId,
        playerAName: playerAName.trim(),
        playerBName: playerBName.trim(),
        format,
        firstServer,
        gamesPerSet: gamesPerSetNumber,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => navigation.replace("TennisLiveScoring", { matchId }),
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
        <CardSection icon="person-outline" title="Player A">
          <FieldInput value={playerAName} onChangeText={setPlayerAName} placeholder="e.g. Alex" maxLength={40} />
        </CardSection>

        <CardSection icon="person-outline" title="Player B">
          <FieldInput value={playerBName} onChangeText={setPlayerBName} placeholder="e.g. Sam" maxLength={40} />
        </CardSection>

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChangeText={setVenue} placeholder="e.g. Tennis Club Karachi" maxLength={60} />
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

        <CardSection icon="tennisball-outline" title="First Server">
          <PillRow
            options={[
              { label: playerAName.trim() || "Player A", value: "A" as const },
              { label: playerBName.trim() || "Player B", value: "B" as const },
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
