import { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import GradientFill from "./GradientFill";

export type ScorerCandidate = { id: string; name: string; teamName: string };

// Bottom sheet the tournament host uses to assign a scorer to one match's
// card — every tournament member (from every approved team) is listed;
// tapping one immediately assigns them and closes the sheet, same
// single-tap-to-pick pattern as this app's other simple pickers.
export default function SelectScorerModal({
  visible,
  onClose,
  members,
  currentScorerId,
  onSelect,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  members: ScorerCandidate[];
  currentScorerId: string | null;
  onSelect: (userId: string) => void;
  submitting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [pickingId, setPickingId] = useState<string | null>(null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "75%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Select Scorer
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Pick a tournament member to score this match
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: "#142533" }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {members.length === 0 ? (
              <Text className="text-muted text-sm text-center py-6">No tournament members found yet.</Text>
            ) : (
              members.map((member) => {
                const isCurrent = member.id === currentScorerId;
                const isPicking = submitting && pickingId === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => {
                      setPickingId(member.id);
                      onSelect(member.id);
                    }}
                    disabled={submitting}
                    className="flex-row items-center rounded-2xl px-4 py-3 mb-2"
                    style={{
                      gap: 10,
                      borderWidth: 1.5,
                      borderColor: isCurrent ? colors.primary : colors.border,
                      backgroundColor: isCurrent ? colors.primaryLight : "#0A1723",
                    }}
                  >
                    {isCurrent ? (
                      <GradientFill className="items-center justify-center rounded-full" style={{ width: 36, height: 36 }}>
                        <Text className="font-bold text-sm" style={{ color: "white" }}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </GradientFill>
                    ) : (
                      <View
                        className="items-center justify-center rounded-full"
                        style={{ width: 36, height: 36, backgroundColor: "#142533" }}
                      >
                        <Text className="font-bold text-sm" style={{ color: colors.muted }}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className={isCurrent ? "font-bold" : "font-semibold"} style={{ fontSize: 14, color: isCurrent ? colors.primaryDark : colors.ink }} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text className="text-muted text-xs" numberOfLines={1}>
                        {member.teamName}
                      </Text>
                    </View>
                    {isPicking ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isCurrent ? (
                      <GradientFill
                        className="items-center justify-center rounded-full"
                        style={{ width: 22, height: 22 }}
                      >
                        <Ionicons name="checkmark" size={14} color="white" />
                      </GradientFill>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
