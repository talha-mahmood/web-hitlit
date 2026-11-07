import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";

export type PriceRange = { label: string; min: number; max: number | null };

// Bottom sheet for the Venues list's Price filter — same shape/interaction
// as SelectDistanceModal (drag handle, title/subtitle, X, a list of
// options, "Apply Filter" button, picked value staying local until Apply is
// pressed).
export default function SelectPriceModal({
  visible,
  onClose,
  options,
  selected,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  options: readonly PriceRange[];
  selected: PriceRange | null;
  onApply: (range: PriceRange | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<PriceRange | null>(selected);

  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "70%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Select Price
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Only show venues in this price range
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: colors.surfaceOverlay }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {options.map((range) => {
              const selectedNow = draft?.label === range.label;
              return (
                <Pressable
                  key={range.label}
                  onPress={() => setDraft(selectedNow ? null : range)}
                  className="flex-row items-center justify-between"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    marginBottom: 10,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: selectedNow ? colors.primary : colors.border,
                    backgroundColor: selectedNow ? colors.primaryLight : colors.surface,
                  }}
                >
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    {selectedNow ? (
                      <GradientFill className="items-center justify-center rounded-full" style={{ width: 36, height: 36 }}>
                        <Ionicons name="pricetag" size={18} color="white" />
                      </GradientFill>
                    ) : (
                      <View
                        className="items-center justify-center rounded-full"
                        style={{ width: 36, height: 36, backgroundColor: colors.surfaceOverlay }}
                      >
                        <Ionicons name="pricetag-outline" size={18} color={colors.muted} />
                      </View>
                    )}
                    <Text
                      className={selectedNow ? "font-bold" : "font-semibold"}
                      style={{ fontSize: 15.5, color: selectedNow ? colors.primaryDark : colors.ink }}
                    >
                      {range.label}
                    </Text>
                  </View>
                  {selectedNow && (
                    <GradientFill
                      className="items-center justify-center rounded-full"
                      style={{ width: 20, height: 20 }}
                    >
                      <Ionicons name="checkmark" size={13} color="white" />
                    </GradientFill>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="px-5 pt-3 flex-row" style={{ gap: 10 }}>
            <Pressable
              onPress={() => onApply(null)}
              className="flex-1 items-center justify-center rounded-2xl"
              style={{ height: 52, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }}
            >
              <Text className="text-ink font-bold" style={{ fontSize: 16 }}>
                Clear
              </Text>
            </Pressable>
            <Pressable onPress={() => onApply(draft)} style={[{ flex: 1 }, primaryButtonShadow]}>
              <GradientFill className="items-center justify-center rounded-2xl" style={{ height: 52 }}>
                <Text className="text-jazba-white font-bold" style={{ fontSize: 16 }}>
                  Apply Filter
                </Text>
              </GradientFill>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
