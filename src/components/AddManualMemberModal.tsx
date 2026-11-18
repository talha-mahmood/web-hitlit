import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SectionLabel } from "./GameFormControls";
import FieldInput from "./FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../lib/nameValidation";

// A percentage maxHeight ("85%") resolves against the KeyboardAvoidingView's
// own auto-sized height (it isn't flex:1), which Yoga computes differently
// depending on how much content is inside — with just one name row the
// sheet's intrinsic height collapses almost to nothing instead of the
// intended 85% of the screen, clipping the field and hiding the "Add
// Another Player" button below the fold. An explicit pixel value sidesteps
// that (same fix as InviteUsersModal/PollCreateModal).
const MODAL_MAX_HEIGHT = Dimensions.get("window").height * 0.85;

// Same bottom-sheet shape as RenameTeamModal/CreateTeamModal — host-only,
// for players who don't have (or don't want to create) an app account.
// They land on the roster immediately (no approval step, same as any other
// host-initiated add) with no user_id at all, shown with the app's default
// avatar everywhere a real member would show their photo/initials.
//
// Multiple players can be queued in one go (one name field per player) —
// blank rows are silently ignored at submit time, so the host can leave a
// trailing empty row without it blocking the add. `onSubmit` is handed every
// non-blank, trimmed name; the caller adds them one by one server-side
// (there's no bulk-insert RPC) and reports back how many actually landed.
export default function AddManualMemberModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  maxPlayers,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (names: string[]) => void;
  submitting: boolean;
  // The team's remaining open roster slots, when known — caps how many name
  // rows the host can add at once. Null/undefined means no known cap.
  maxPlayers?: number | null;
}) {
  const insets = useSafeAreaInsets();
  const [names, setNames] = useState<string[]>([""]);

  useEffect(() => {
    if (visible) setNames([""]);
  }, [visible]);

  const canAddRow = maxPlayers == null || names.length < maxPlayers;
  const trimmedNames = names.map((n) => n.trim()).filter((n) => n.length > 0);

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const removeRow = (index: number) => {
    setNames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const invalid = trimmedNames.find((n) => !isValidName(n));
    if (invalid) {
      Alert.alert("Invalid Name", `Player name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (trimmedNames.length === 0) return;
    onSubmit(trimmedNames);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-surface rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, maxHeight: MODAL_MAX_HEIGHT, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Add Players Manually</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              For players who don't have an app account — they're added to the team right away.
            </Text>

            <ScrollView bounces={false} style={{ maxHeight: 320 }} contentContainerStyle={{ paddingTop: 4 }}>
              {names.map((name, i) => (
                <View key={i} className="mb-3">
                  <SectionLabel title={`Player ${i + 1} Name`} required={i === 0} />
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View className="flex-1">
                      <FieldInput
                        value={name}
                        onChangeText={(t) => updateName(i, t)}
                        placeholder="e.g. Imran Khan"
                        maxLength={60}
                        autoFocus={i === 0}
                      />
                    </View>
                    {names.length > 1 && (
                      <Pressable onPress={() => removeRow(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={22} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}

              {canAddRow && (
                <Pressable
                  onPress={() => setNames((prev) => [...prev, ""])}
                  className="flex-row items-center justify-center rounded-xl py-2.5 mb-2"
                  style={{ gap: 6, borderWidth: 1.5, borderColor: colors.primary }}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text className="text-primary text-sm font-bold">Add Another Player</Text>
                </Pressable>
              )}
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={trimmedNames.length === 0 || submitting}
              style={trimmedNames.length > 0 ? primaryButtonShadow : undefined}
            >
              {trimmedNames.length > 0 ? (
                <GradientFill className="rounded-xl py-4 items-center mt-4">
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="font-semibold text-base text-jazba-white">
                      Add {trimmedNames.length > 1 ? `${trimmedNames.length} Players` : "Player"}
                    </Text>
                  )}
                </GradientFill>
              ) : (
                <View className="rounded-xl py-4 items-center mt-4 bg-gray-200">
                  <Text className="font-semibold text-base text-muted">Add Player</Text>
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
