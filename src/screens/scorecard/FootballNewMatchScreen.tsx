import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateFootballMatch } from "../../hooks/useFootball";
import { friendlyFootballError } from "../../lib/api/football";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "FootballNewMatch">;

// Presets are TOTAL match minutes (both halves combined) — the familiar way
// a casual match gets described ("we're playing a 30 minute match"). Each
// is split into two equal halves when creating the match.
const DURATION_PRESETS = ["20", "30", "40", "60", "90"];
const STANDARD_TOTAL_MINUTES = 90;

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

export default function FootballNewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateFootballMatch();

  const [teamAName, setTeamAName] = useState("");
  const [teamBName, setTeamBName] = useState("");
  const [requiresWinner, setRequiresWinner] = useState<"NO" | "YES" | null>("NO");
  const [totalMinutes, setTotalMinutes] = useState<string | null>(String(STANDARD_TOTAL_MINUTES));
  const [venue, setVenue] = useState("");

  const totalMinutesNumber = parseInt(totalMinutes ?? "", 10);
  const isDurationValid = !!totalMinutes && totalMinutesNumber > 0;
  const halfDurationMinutes = isDurationValid ? Math.max(1, Math.round(totalMinutesNumber / 2)) : 0;
  const actualTotalMinutes = halfDurationMinutes * 2;

  const isValid = teamAName.trim().length > 0 && teamBName.trim().length > 0 && !!requiresWinner && isDurationValid;

  const handleCreate = () => {
    if (!isValid || !userId || !requiresWinner) return;
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        requiresWinner: requiresWinner === "YES",
        halfDurationMinutes,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => navigation.replace("FootballLiveScoring", { matchId }),
        onError: (err) => Alert.alert("Error", friendlyFootballError(err, "Could not create match.")),
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
          <Text className="text-2xl font-bold text-ink">New Football Match</Text>
          <Text className="text-muted text-sm mt-0.5">Kicks off immediately once created</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <CardSection icon="shirt-outline" title="Team A">
          <FieldInput value={teamAName} onChangeText={setTeamAName} placeholder="e.g. Strikers FC" maxLength={40} />
        </CardSection>

        <CardSection icon="shirt-outline" title="Team B">
          <FieldInput value={teamBName} onChangeText={setTeamBName} placeholder="e.g. United FC" maxLength={40} />
        </CardSection>

        <CardSection icon="location-outline" title="Venue">
          <FieldInput value={venue} onChangeText={setVenue} placeholder="e.g. City Stadium" maxLength={60} />
        </CardSection>

        <CardSection icon="time-outline" title="Match Duration">
          <PillRow
            options={DURATION_PRESETS.map((n) => ({ label: n === "90" ? "90 (Standard)" : n, value: n }))}
            value={DURATION_PRESETS.includes(totalMinutes ?? "") ? totalMinutes : null}
            onChange={setTotalMinutes}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom total (minutes)</Text>
          <FieldInput
            value={totalMinutes ?? ""}
            onChangeText={(t) => setTotalMinutes(t.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="e.g. 10"
            keyboardType="number-pad"
            maxLength={3}
          />
          <InfoBox
            text={
              isDurationValid
                ? `Split into two ${halfDurationMinutes}-minute halves${actualTotalMinutes !== totalMinutesNumber ? ` (${actualTotalMinutes} min total)` : ""}.`
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
              requiresWinner === "YES"
                ? `If the match is level after ${isDurationValid ? actualTotalMinutes : STANDARD_TOTAL_MINUTES} minutes, you'll be offered extra time, then a penalty shootout if it's still level.`
                : `A draw after ${isDurationValid ? actualTotalMinutes : STANDARD_TOTAL_MINUTES} minutes ends the match — no extra time or shootout will be offered.`
            }
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
              <Text className={`font-bold text-base ${isValid ? "text-white" : "text-muted"}`}>Kick Off</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
