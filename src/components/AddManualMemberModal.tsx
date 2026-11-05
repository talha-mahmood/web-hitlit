import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../lib/nameValidation";

// Same bottom-sheet shape as RenameTeamModal/CreateTeamModal — host-only,
// for a player who doesn't have (or doesn't want to create) an app account.
// They land on the roster immediately (no approval step, same as any other
// host-initiated add) with no user_id at all, shown with the app's default
// avatar everywhere a real member would show their photo/initials.
export default function AddManualMemberModal({
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

  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  const handleSave = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Player name must be ${NAME_REQUIREMENT_HINT}.`);
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
              <Text className="text-lg font-bold text-ink">Add Player Manually</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              For a player who doesn't have an app account — they're added to the team right away.
            </Text>

            <SectionLabel title="Player Name" required />
            <FieldInput value={name} onChangeText={setName} placeholder="e.g. Imran Khan" maxLength={60} autoFocus />

            <Pressable
              onPress={handleSave}
              disabled={!name.trim() || submitting}
              style={name.trim() ? primaryButtonShadow : undefined}
            >
              {name.trim() ? (
                <GradientFill className="rounded-xl py-4 items-center mt-6">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-jazba-white">Add Player</Text>}
                </GradientFill>
              ) : (
                <View className="rounded-xl py-4 items-center mt-6 bg-gray-200">
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-base text-muted">Add Player</Text>}
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
