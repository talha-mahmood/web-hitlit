import { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import { EMOJI_CATEGORIES } from "../lib/emojiList";

// Bottom sheet emoji grid shared by every chat composer (game/team/squad
// chat and the community MentionComposer) — same drag-handle/X bottom-sheet
// shape as SelectLocationModal/SelectGroupTypeModal. Picking an emoji just
// hands the character back via onPick; each composer decides how to splice
// it into its own text (cursor position for MentionComposer, which already
// tracks selection, or appended at the end for the simpler plain-TextInput
// composers).
export default function EmojiPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 12 + insets.bottom, maxHeight: "60%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-center justify-between px-5 pt-2 pb-2">
            <Text className="text-ink font-extrabold" style={{ fontSize: 18 }}>
              Emoji
            </Text>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 30, height: 30, backgroundColor: "#142533" }}
              hitSlop={6}
            >
              <Ionicons name="close" size={16} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {EMOJI_CATEGORIES.map((cat, i) => {
              const active = category === i;
              return (
                <Pressable
                  key={cat.label}
                  onPress={() => setCategory(i)}
                  className="rounded-full px-3.5 py-1.5"
                  style={{ backgroundColor: active ? colors.primary : "#142533" }}
                >
                  <Text className="font-semibold text-xs" style={{ color: active ? "white" : colors.muted }}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 16, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {EMOJI_CATEGORIES[category].emojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onPick(emoji)}
                className="items-center justify-center"
                style={{ width: 44, height: 44 }}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
