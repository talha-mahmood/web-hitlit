import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { DAYS, TIME_SLOTS, isTimeSlotPast } from "../lib/gameFormHelpers";

// Manual per-match scheduling — no automatic conflict-checking against
// venue slot/pitch availability, just "when did you plan to play this
// one" for the match card to show. Reuses the same DAYS/TIME_SLOTS chip
// data CreateGameScreen's own date/time pickers are built from, so this
// reads as the same picker the host already knows from creating the
// tournament.
export default function SetMatchTimeModal({
  visible,
  onClose,
  initialIso,
  onConfirm,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  initialIso: string | null;
  onConfirm: (iso: string) => void;
  submitting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [dateIso, setDateIso] = useState(DAYS[0].iso);
  const [timeValue, setTimeValue] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initialIso) {
      const d = new Date(initialIso);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setDateIso(iso);
      setTimeValue(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setDateIso(DAYS[0].iso);
      setTimeValue(null);
    }
  }, [visible, initialIso]);

  const availableTimes = TIME_SLOTS.filter((t) => !isTimeSlotPast(dateIso, t.value));
  const canConfirm = !!timeValue && availableTimes.some((t) => t.value === timeValue);

  const handleConfirm = () => {
    if (!canConfirm || !timeValue) return;
    onConfirm(`${dateIso}T${timeValue}:00+05:00`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "75%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-1 mr-3">
              <Text className="text-ink font-extrabold" style={{ fontSize: 20 }}>
                Set Match Time
              </Text>
              <Text className="text-muted text-xs mt-0.5">Shown on the match card — doesn't book the venue</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 4 }} bounces={false}>
            <Text className="text-ink text-xs font-bold mb-2">Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {DAYS.filter((d) => TIME_SLOTS.some((t) => !isTimeSlotPast(d.iso, t.value))).map((d) => {
                const selected = dateIso === d.iso;
                return (
                  <Pressable
                    key={d.iso}
                    onPress={() => {
                      setDateIso(d.iso);
                      if (timeValue && isTimeSlotPast(d.iso, timeValue)) setTimeValue(null);
                    }}
                  >
                    {selected ? (
                      <GradientFill className="items-center px-3 py-2.5 rounded-2xl">
                        <Text className="text-xs text-jazba-white">{d.day}</Text>
                        <Text className="text-base font-bold mt-0.5 text-jazba-white">{d.label}</Text>
                      </GradientFill>
                    ) : (
                      <View className="items-center px-3 py-2.5 rounded-2xl" style={{ borderWidth: 1.5, borderColor: colors.border }}>
                        <Text className="text-xs text-muted">{d.day}</Text>
                        <Text className="text-base font-bold mt-0.5 text-ink">{d.label}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="text-ink text-xs font-bold mt-4 mb-2">Time</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {availableTimes.map((t) => {
                const selected = timeValue === t.value;
                return (
                  <Pressable key={t.value} onPress={() => setTimeValue(t.value)}>
                    {selected ? (
                      <GradientFill className="px-3.5 py-2.5 rounded-2xl">
                        <Text className="text-sm font-medium text-jazba-white">{t.label}</Text>
                      </GradientFill>
                    ) : (
                      <View className="px-3.5 py-2.5 rounded-2xl" style={{ borderWidth: 1.5, borderColor: colors.border }}>
                        <Text className="text-sm font-medium text-ink">{t.label}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="pt-3">
            <Pressable onPress={handleConfirm} disabled={!canConfirm || submitting} style={canConfirm ? primaryButtonShadow : undefined}>
              {canConfirm ? (
                <GradientFill className="items-center rounded-2xl py-4">
                  <Text className="text-jazba-white font-bold" style={{ fontSize: 16 }}>
                    {submitting ? "Saving…" : "Save Time"}
                  </Text>
                </GradientFill>
              ) : (
                <View className="items-center rounded-2xl py-4 bg-gray-200">
                  <Text className="text-muted font-bold" style={{ fontSize: 16 }}>
                    Save Time
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
