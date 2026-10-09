import { useState } from "react";
import { Modal, View, Text, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../lib/nameValidation";

export default function CreateTeamModal({
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");

  const handleCreate = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Team name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    onSubmit(name.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        {/* "padding" on both platforms — this sheet is bottom-anchored
            (justify-end) with fixed, non-scrolling content and an
            auto-focused field, so padding pushes the whole sheet up above
            the keyboard instead of leaving it hidden behind it. */}
        <KeyboardAvoidingView behavior="padding">
          {/* Shadow points up (negative height) since this sheet rises from
              the bottom of the screen. */}
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Create a Team</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              Give your team a name — invite players to join, and it's added to the tournament
              automatically once your roster is full.
            </Text>

            <SectionLabel title="Team Name" required />
            <FieldInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Thunder Strikers"
              maxLength={60}
              autoFocus
            />

            <Pressable
              onPress={handleCreate}
              disabled={!name.trim() || submitting}
              style={name.trim() ? primaryButtonShadow : undefined}
            >
              {name.trim() ? (
                <GradientFill className="rounded-xl py-4 items-center mt-6">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-white">Create Team</Text>}
                </GradientFill>
              ) : (
                <View className="rounded-xl py-4 items-center mt-6 bg-gray-200">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-muted">Create Team</Text>}
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
