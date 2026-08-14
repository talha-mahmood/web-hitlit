import { useState } from "react";
import { Modal, View, Text, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
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
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
              <Text className="text-lg font-bold text-ink flex-1 text-center">Create a Team</Text>
              <Pressable
                onPress={handleCreate}
                disabled={!name.trim() || submitting}
                className="rounded-xl px-4 py-2"
                style={{
                  backgroundColor: name.trim() ? colors.primary : "#E5E7EB",
                  ...(name.trim() ? primaryButtonShadow : null),
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className={`font-semibold text-sm ${name.trim() ? "text-white" : "text-muted"}`}>
                    Post
                  </Text>
                )}
              </Pressable>
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
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
