import { Modal, View, Text, Pressable, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import AddMemberByIdField from "./AddMemberByIdField";

// Bottom-sheet wrapper around AddMemberByIdField, styled like
// InviteUsersModal's sheet — the owner/host-facing instant-add counterpart
// to that modal's invite-then-accept flow.
export default function AddMemberByIdModal({
  visible,
  onClose,
  squadId,
  excludeUserIds,
  disabledReason,
}: {
  visible: boolean;
  onClose: () => void;
  squadId: string;
  excludeUserIds: string[];
  disabledReason?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-bold text-ink">Add Player by ID</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-xs mb-4">
              They're added instantly — no invite to accept.
            </Text>

            <AddMemberByIdField squadId={squadId} excludeUserIds={excludeUserIds} disabledReason={disabledReason} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
