import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";

// Bottom sheet for a list screen's Distance filter — same shape/interaction
// as SelectSportModal (drag handle, title/subtitle, X, a list of options,
// "Apply Filter" button, picked value staying local until Apply is
// pressed), used in place of the old small popover dropdown so Distance
// behaves like the Sports filter.
export default function SelectDistanceModal({
  visible,
  onClose,
  options,
  selectedKm,
  onApply,
  locationDenied,
}: {
  visible: boolean;
  onClose: () => void;
  options: readonly number[];
  selectedKm: number | null;
  onApply: (km: number | null) => void;
  locationDenied?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<number | null>(selectedKm);

  useEffect(() => {
    if (visible) setDraft(selectedKm);
  }, [visible, selectedKm]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "70%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Select Distance
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Only show results within this range
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

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {locationDenied && (
              <Text className="text-muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                Enable location to filter by distance.
              </Text>
            )}
            {options.map((km) => {
              const selected = draft === km;
              return (
                <Pressable
                  key={km}
                  onPress={() => setDraft(selected ? null : km)}
                  className="flex-row items-center justify-between"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    marginBottom: 10,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primaryLight : "white",
                  }}
                >
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 36, height: 36, backgroundColor: selected ? colors.primary : "#F3F4F6" }}
                    >
                      <Ionicons name="location" size={18} color={selected ? "white" : colors.muted} />
                    </View>
                    <Text
                      className={selected ? "font-bold" : "font-semibold"}
                      style={{ fontSize: 15.5, color: selected ? colors.primaryDark : colors.ink }}
                    >
                      Within {km} km
                    </Text>
                  </View>
                  {selected && (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 20, height: 20, backgroundColor: colors.primary }}
                    >
                      <Ionicons name="checkmark" size={13} color="white" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="px-5 pt-3">
            <Pressable
              onPress={() => onApply(draft)}
              className="items-center rounded-2xl bg-primary py-4"
              style={primaryButtonShadow}
            >
              <Text className="text-white font-bold" style={{ fontSize: 16 }}>
                Apply Filter
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
