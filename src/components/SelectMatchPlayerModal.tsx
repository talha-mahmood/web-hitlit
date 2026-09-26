import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";

// Bottom sheet for picking which of a team's (free-text) players scored a
// point — same single-tap-to-pick shell as SelectScorerModal, just over a
// plain list of names instead of tournament members.
export default function SelectMatchPlayerModal({
  visible,
  onClose,
  teamName,
  players,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  players: string[];
  onSelect: (playerName: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "75%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Select a Player
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Who scored for {teamName}?
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: "#F3F4F6" }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {players.length === 0 ? (
              <Text className="text-muted text-sm text-center py-6">No players added for this team.</Text>
            ) : (
              players.map((name, i) => (
                <Pressable
                  key={`${name}-${i}`}
                  onPress={() => onSelect(name)}
                  className="flex-row items-center rounded-2xl px-4 py-3 mb-2"
                  style={{ gap: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "white" }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 36, height: 36, backgroundColor: "#F3F4F6" }}
                  >
                    <Text className="font-bold text-sm" style={{ color: colors.muted }}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="font-semibold flex-1" style={{ fontSize: 14, color: colors.ink }} numberOfLines={1}>
                    {name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
