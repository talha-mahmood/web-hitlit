import { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";

const MAX_OPTIONS = 6;

// A percentage maxHeight resolves against the KeyboardAvoidingView's own
// auto-sized height (it isn't flex:1), which collapses to fit whatever
// content is there rather than a real 85% of the screen — an explicit
// pixel value sidesteps that (see InviteUsersModal for the same fix).
const MODAL_MAX_HEIGHT = Dimensions.get("window").height * 0.85;

// Same bottom-sheet shape as SelectPriceModal (drag handle, title/subtitle
// + close X, scrollable body, a full-width primary button pinned at the
// bottom) — a question field plus a growable list of option fields instead
// of a fixed option list.
export default function PollCreateModal({
  visible,
  onClose,
  onCreate,
  creating,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
  creating?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setOptions(["", ""]);
    }
  }, [visible]);

  const setOptionText = (index: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && trimmedOptions.length >= 2 && !creating;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(question.trim(), trimmedOptions);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        {/* "padding" on both platforms — same as every other TextInput-
            carrying bottom sheet in this app (CreateTeamModal,
            InviteUsersModal, …) — pushes the whole sheet up above the
            keyboard instead of leaving fields hidden behind it. */}
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-surface rounded-t-3xl"
            style={{ paddingBottom: 20 + insets.bottom, maxHeight: MODAL_MAX_HEIGHT, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="items-center pt-2.5 pb-1">
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
              <View className="flex-1">
                <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                  Create Poll
                </Text>
                <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                  Ask a question, members vote for one option
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

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="text-ink text-xs font-bold mb-1.5">Question</Text>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="e.g. What time should we start?"
                placeholderTextColor={colors.muted}
                className="rounded-2xl px-4 py-3 text-ink"
                style={{ borderWidth: 1.5, borderColor: colors.border, fontSize: 14.5 }}
                maxLength={200}
                multiline
              />

              <Text className="text-ink text-xs font-bold mt-4 mb-1.5">Options</Text>
              {options.map((option, index) => (
                <View key={index} className="flex-row items-center mb-2.5" style={{ gap: 8 }}>
                  <TextInput
                    value={option}
                    onChangeText={(t) => setOptionText(index, t)}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={colors.muted}
                    className="flex-1 rounded-2xl px-4 py-3 text-ink"
                    style={{ borderWidth: 1.5, borderColor: colors.border, fontSize: 14.5 }}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Pressable onPress={() => removeOption(index)} hitSlop={8} className="p-1">
                      <Ionicons name="close-circle" size={22} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              ))}

              {options.length < MAX_OPTIONS && (
                <Pressable
                  onPress={() => setOptions((prev) => [...prev, ""])}
                  className="flex-row items-center mt-1 mb-2"
                  style={{ gap: 6 }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text className="text-primary text-sm font-semibold">Add option</Text>
                </Pressable>
              )}
            </ScrollView>

            <View className="px-5 pt-3">
              <Pressable onPress={handleCreate} disabled={!canCreate} style={canCreate ? primaryButtonShadow : undefined}>
                {canCreate ? (
                  <GradientFill className="items-center rounded-2xl py-4">
                    <Text className="text-jazba-white font-bold" style={{ fontSize: 16 }}>
                      {creating ? "Creating…" : "Create Poll"}
                    </Text>
                  </GradientFill>
                ) : (
                  <View className="items-center rounded-2xl py-4 bg-gray-200">
                    <Text className="text-muted font-bold" style={{ fontSize: 16 }}>
                      Create Poll
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
