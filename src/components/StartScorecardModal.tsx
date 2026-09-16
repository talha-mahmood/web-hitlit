import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { PillRow, SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";

const OVERS_PRESETS = ["5", "10", "20"];

// The one bit of match setup that can't be auto-filled from the tournament
// match itself (team names/players come straight from the two teams'
// rosters) — the toss is decided in person right before play, so this stays
// a quick manual step instead of a full New Match screen.
export default function StartScorecardModal({
  visible,
  onClose,
  teamAName,
  teamBName,
  submitting,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  teamAName: string;
  teamBName: string;
  submitting: boolean;
  onSubmit: (params: { oversLimit: number; tossWinner: "A" | "B"; tossDecision: "BAT" | "BOWL" }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [oversLimit, setOversLimit] = useState<string | null>("20");
  const [tossWinner, setTossWinner] = useState<"A" | "B" | null>(null);
  const [tossDecision, setTossDecision] = useState<"BAT" | "BOWL" | null>(null);

  useEffect(() => {
    if (!visible) {
      setOversLimit("20");
      setTossWinner(null);
      setTossDecision(null);
    }
  }, [visible]);

  const isValid = !!oversLimit && parseInt(oversLimit, 10) > 0 && !!tossWinner && !!tossDecision;

  const handleStart = () => {
    if (!isValid || !oversLimit || !tossWinner || !tossDecision) return;
    onSubmit({ oversLimit: parseInt(oversLimit, 10), tossWinner, tossDecision });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink flex-1" numberOfLines={1}>
                Start Scorecard
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              {teamAName} vs {teamBName} — just the toss to go before scoring starts.
            </Text>

            <SectionLabel title="Overs per Innings" required compact />
            <PillRow
              options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))}
              value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null}
              onChange={setOversLimit}
            />
            <FieldInput
              value={oversLimit ?? ""}
              onChangeText={(t) => setOversLimit(t.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder="Or enter a custom number"
              keyboardType="number-pad"
              maxLength={3}
              containerStyle={{ marginTop: 8 }}
            />

            <SectionLabel title="Toss Winner" required compact />
            <PillRow
              options={[
                { label: teamAName, value: "A" as const },
                { label: teamBName, value: "B" as const },
              ]}
              value={tossWinner}
              onChange={setTossWinner}
            />

            <SectionLabel title="Toss Decision" required compact />
            <PillRow
              options={[
                { label: "Bat", value: "BAT" as const },
                { label: "Bowl", value: "BOWL" as const },
              ]}
              value={tossDecision}
              onChange={setTossDecision}
            />

            <Pressable
              onPress={handleStart}
              disabled={!isValid || submitting}
              className={`rounded-xl py-4 items-center mt-6 ${isValid ? "bg-primary" : "bg-gray-200"}`}
              style={isValid ? primaryButtonShadow : undefined}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-semibold text-base ${isValid ? "text-white" : "text-muted"}`}>
                  Go To Scorecard
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
