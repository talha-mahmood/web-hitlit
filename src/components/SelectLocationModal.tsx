import { useState, useEffect } from "react";
import { Modal, View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { PAKISTAN_CITIES } from "../lib/pakistanCities";

// Bottom sheet for a list screen's Location filter — same shape/interaction
// as SelectSportModal/SelectDistanceModal (drag handle, title/subtitle, X, a
// list of options, "Apply Filter" button, picked value staying local until
// Apply is pressed). Unlike those two, the "options" here are just quick-pick
// suggestions — a free-text field above them still lets you type any
// location, same as the old always-visible field did.
export default function SelectLocationModal({
  visible,
  onClose,
  value,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  value: string;
  onApply: (location: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Filter by Location
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Pick a city or type any location
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

          <View className="px-5 pb-3">
            <View
              className="flex-row items-center rounded-2xl px-4"
              style={{ borderWidth: 1.5, borderColor: draft ? colors.primary : colors.border, backgroundColor: draft ? colors.primaryLight : "white" }}
            >
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="e.g. DHA Phase 6, Lahore"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-ink text-sm ml-2"
                style={{ paddingVertical: 12 }}
              />
              {draft.length > 0 && (
                <Pressable onPress={() => setDraft("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.border} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            <Text className="text-muted font-semibold" style={{ fontSize: 12, marginBottom: 10, letterSpacing: 0.3 }}>
              SUGGESTED CITIES
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {PAKISTAN_CITIES.map((city) => {
                const selected = draft.trim().toLowerCase() === city.toLowerCase();
                return (
                  <Pressable
                    key={city}
                    onPress={() => setDraft(selected ? "" : city)}
                    className="flex-row items-center rounded-full"
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      gap: 6,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : "white",
                    }}
                  >
                    {selected && <Ionicons name="checkmark" size={13} color="white" />}
                    <Text
                      className={selected ? "font-bold" : "font-medium"}
                      style={{ fontSize: 13.5, color: selected ? "white" : colors.ink }}
                    >
                      {city}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="px-5 pt-3" style={{ gap: 8 }}>
            <Pressable
              onPress={() => onApply(draft.trim())}
              className="items-center rounded-2xl bg-primary py-4"
              style={primaryButtonShadow}
            >
              <Text className="text-white font-bold" style={{ fontSize: 16 }}>
                Apply Filter
              </Text>
            </Pressable>
            {!!value && (
              <Pressable onPress={() => onApply("")} className="items-center py-2">
                <Text className="text-muted font-semibold" style={{ fontSize: 13.5 }}>
                  Clear location filter
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
