import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";

// Shared by every sport's "View Scoring" tab (see e.g.
// CricketScorecardHomeScreen) — looks up a match by the short scoring code
// shown on its Live Scoring screen, for anyone who wants to watch without
// being a player/host. Each sport supplies its own lookup (findXMatchByCode)
// and is responsible for navigating to FullScorecard once one resolves.
export default function ViewScoringPanel({
  onLookup,
}: {
  // Resolves to the matchId to open, or null if no match has this code.
  onLookup: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const matchId = await onLookup(trimmed);
      if (!matchId) setError("No match found with this scoring ID. Double-check the code and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="px-5 mt-6" style={{ gap: 16 }}>
      <View className="items-center" style={{ gap: 8 }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 64, height: 64, backgroundColor: colors.primaryLight }}
        >
          <Ionicons name="eye-outline" size={28} color={colors.primaryDark} />
        </View>
        <Text className="text-ink font-bold text-base text-center">View a Match's Scoring</Text>
        <Text className="text-muted text-sm text-center px-4">
          Enter the scoring ID shared by the host to watch this match's scorecard — you don't need to be a
          player.
        </Text>
      </View>
      <View className="bg-surface rounded-2xl border border-border px-4 py-2" style={cardShadow}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setError(null);
          }}
          onSubmitEditing={handleSubmit}
          placeholder="e.g. 7K2M9P"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          className="text-ink font-semibold text-center"
          style={{ fontSize: 22, letterSpacing: 4, paddingVertical: 10 }}
        />
      </View>
      {error ? <Text className="text-danger text-sm text-center px-2">{error}</Text> : null}
      <Pressable
        onPress={handleSubmit}
        disabled={loading || !code.trim()}
        style={{ ...primaryButtonShadow, opacity: loading || !code.trim() ? 0.6 : 1 }}
      >
        <GradientFill className="rounded-xl py-4 items-center">
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-jazba-white font-bold text-base">View Scorecard</Text>}
        </GradientFill>
      </Pressable>
    </View>
  );
}
