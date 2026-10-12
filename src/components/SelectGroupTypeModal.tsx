import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import type { SquadGroupType } from "../lib/api/squads";

const GROUP_TYPE_OPTIONS: { label: string; value: SquadGroupType }[] = [
  { label: "Group", value: "group" },
  { label: "Club", value: "club" },
  { label: "Training Camp", value: "training_camp" },
];

// Bottom sheet for the groups list's "Group Type" filter — same shape as
// SelectLocationModal (drag handle, title/subtitle, X, "Apply Filter"
// button, picked values staying local until Apply is pressed), just a
// fixed 3-option multi-select instead of free-text + suggestions.
export default function SelectGroupTypeModal({
  visible,
  onClose,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: SquadGroupType[];
  onApply: (types: SquadGroupType[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SquadGroupType[]>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const toggle = (type: SquadGroupType) => {
    setDraft((prev) => (prev.includes(type) ? prev.filter((v) => v !== type) : [...prev, type]));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Filter by Group Type
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Pick any number of group types
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: "#F3F4F6" }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <View className="flex-row flex-wrap px-5" style={{ gap: 8, marginBottom: 20 }}>
            {GROUP_TYPE_OPTIONS.map((opt) => {
              const selected = draft.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggle(opt.value)}
                  style={{ borderRadius: 999, borderWidth: 1.5, borderColor: selected ? colors.primary : colors.border }}
                >
                  {selected ? (
                    <GradientFill className="flex-row items-center rounded-full" style={{ paddingHorizontal: 14, paddingVertical: 9, gap: 6 }}>
                      <Ionicons name="checkmark" size={13} color="white" />
                      <Text className="font-bold" style={{ fontSize: 13.5, color: "white" }}>
                        {opt.label}
                      </Text>
                    </GradientFill>
                  ) : (
                    <View className="flex-row items-center rounded-full" style={{ paddingHorizontal: 14, paddingVertical: 9, gap: 6, backgroundColor: "white" }}>
                      <Text className="font-medium" style={{ fontSize: 13.5, color: colors.ink }}>
                        {opt.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View className="px-5 pt-1" style={{ gap: 8 }}>
            <Pressable onPress={() => onApply(draft)} style={primaryButtonShadow}>
              <GradientFill className="items-center rounded-2xl py-4">
                <Text className="text-white font-bold" style={{ fontSize: 16 }}>
                  Apply Filter
                </Text>
              </GradientFill>
            </Pressable>
            {value.length > 0 && (
              <Pressable onPress={() => onApply([])} className="items-center py-2">
                <Text className="text-muted font-semibold" style={{ fontSize: 13.5 }}>
                  Clear group type filter
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
