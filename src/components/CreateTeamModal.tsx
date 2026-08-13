import { useState } from "react";
import { Modal, View, Text, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";
import Bouncy from "./Bouncy";
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
            style={{ paddingBottom: 32, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Create a Team</Text>
              <Bouncy onPress={onClose} scaleTo={0.8} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Bouncy>
            </View>
            <Text className="text-muted text-sm mb-2">
              You'll be the team captain — invite players to join, then submit your team for the
              host's approval once it's full.
            </Text>

            <SectionLabel title="Team Name" required />
            <FieldInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Thunder Strikers"
              maxLength={60}
              autoFocus
            />

            <Bouncy
              onPress={handleCreate}
              disabled={!name.trim() || submitting}
              className={`rounded-xl py-4 items-center mt-6 ${name.trim() ? "bg-primary" : "bg-gray-200"}`}
              style={name.trim() ? primaryButtonShadow : undefined}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-semibold text-base ${name.trim() ? "text-white" : "text-muted"}`}>
                  Create Team
                </Text>
              )}
            </Bouncy>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
