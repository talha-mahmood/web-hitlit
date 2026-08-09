import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { SectionLabel } from "./GameFormControls";

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
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 32 }}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Create a Team</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              You'll be the team captain — invite players to join, then submit your team for the
              host's approval once it's full.
            </Text>

            <SectionLabel title="Team Name" required />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Thunder Strikers"
              className="border border-border rounded-xl px-4 py-3 text-ink"
              maxLength={60}
              autoFocus
            />

            <Pressable
              onPress={handleCreate}
              disabled={!name.trim() || submitting}
              className={`rounded-xl py-4 items-center mt-6 ${name.trim() ? "bg-primary" : "bg-gray-200"}`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-semibold text-base ${name.trim() ? "text-white" : "text-muted"}`}>
                  Create Team
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
