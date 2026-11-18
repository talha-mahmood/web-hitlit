import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";

export default function TeamManagerRequiredModal({
  visible,
  onClose,
  onCreateTeam,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateTeam: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.72)" }}>
        <View className="w-full rounded-3xl border border-border bg-surface px-6 pt-7 pb-6" style={{ maxWidth: 440 }}>
          <View className="items-center">
            <View className="items-center justify-center rounded-full" style={{ width: 76, height: 76, backgroundColor: colors.infoLight }}>
              <Ionicons name="information-circle" size={46} color="#38BDF8" />
            </View>
            <Text className="mt-5 text-center font-extrabold" style={{ color: "#38BDF8", fontSize: 23 }}>
              Create a team first
            </Text>
            <Text className="mt-3 text-center text-muted" style={{ fontSize: 17, lineHeight: 25 }}>
              Challenging and messaging teams is for team managers. Create your team first.
            </Text>
          </View>
          <View className="mt-6" style={{ gap: 10 }}>
            <Pressable onPress={onClose} className="items-center justify-center rounded-2xl border border-border bg-surfaceRaised" style={{ minHeight: 58 }}>
              <Text className="text-ink text-lg font-bold">Not now</Text>
            </Pressable>
            <Pressable onPress={onCreateTeam} className="items-center justify-center rounded-2xl" style={{ minHeight: 58, backgroundColor: colors.primary }}>
              <Text className="text-white text-lg font-bold">Create Team</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
