import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../lib/nameValidation";

// Same bottom-sheet shape as CreateTeamModal, prefilled with the team's
// current name instead of starting blank — host-only, and only offered
// while the team still has open slots (see TeamCard's canEditTeamName).
export default function RenameTeamModal({
  visible,
  initialName,
  onClose,
  onSubmit,
  submitting,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const handleSave = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Team name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    onSubmit(name.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-surface rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Rename Team</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">Change this team's name before its roster fills up.</Text>

            <SectionLabel title="Team Name" required />
            <FieldInput value={name} onChangeText={setName} placeholder="e.g. Thunder Strikers" maxLength={60} autoFocus />

            <Pressable
              onPress={handleSave}
              disabled={!name.trim() || submitting}
              style={name.trim() ? primaryButtonShadow : undefined}
            >
              {name.trim() ? (
                <GradientFill className="rounded-xl py-4 items-center mt-6">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-jazba-white">Save</Text>}
                </GradientFill>
              ) : (
                <View className="rounded-xl py-4 items-center mt-6 bg-gray-200">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-muted">Save</Text>}
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
