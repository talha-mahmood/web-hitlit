import { useState, useEffect } from "react";
import { Modal, View, Text, Image, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";

type Sport = { id: string; name: string };

// Bottom sheet for the Games list's sport filter — a 2-column grid of sport
// tiles (icon circle + name), with the picked sport staying local until
// "Apply Filter" is pressed (so backing out with the X or the backdrop
// leaves the active filter untouched).
export default function SelectSportModal({
  visible,
  onClose,
  sports,
  selectedSportId,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  sports: Sport[];
  selectedSportId: string | undefined;
  onApply: (sportId: string | undefined) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<string | undefined>(selectedSportId);

  // Re-sync the draft to whatever's actually active each time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(selectedSportId);
  }, [visible, selectedSportId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "82%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Select Sport
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Choose a sport to filter games
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
            <View className="flex-row flex-wrap justify-between" style={{ rowGap: 12 }}>
              {sports.map((sport) => {
                const selected = draft === sport.id;
                const { icon, bg, fg } = getSportIcon(sport.name);
                const photo = getSportImage(sport.name);
                return (
                  <Pressable
                    key={sport.id}
                    onPress={() => setDraft(selected ? undefined : sport.id)}
                    className="flex-row items-center"
                    style={{
                      width: "48%",
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : colors.surface,
                    }}
                  >
                    <View
                      className="items-center justify-center overflow-hidden rounded-full"
                      style={{ width: 40, height: 40, backgroundColor: photo ? "#FFFFFF" : bg }}
                    >
                      {photo ? (
                        <Image source={photo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                      ) : (
                        <MaterialCommunityIcons name={icon} size={20} color={fg} />
                      )}
                    </View>
                    <Text
                      className={selected ? "font-bold" : "font-semibold"}
                      style={{ fontSize: 14, color: selected ? colors.primaryDark : colors.ink, flex: 1 }}
                      numberOfLines={1}
                    >
                      {sport.name}
                    </Text>
                    {selected && (
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
            </View>
            {sports.length === 0 && (
              <Text className="text-muted text-sm text-center py-6">No sports found.</Text>
            )}
          </ScrollView>

          <View className="px-5 pt-3 flex-row" style={{ gap: 10 }}>
            <Pressable
              onPress={() => onApply(undefined)}
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
