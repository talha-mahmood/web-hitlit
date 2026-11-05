import { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";

export type JoinableTeam = { id: string; name: string; joinedCount: number; requiredSize: number };

// Bottom sheet the tournament host uses to add themselves to one existing,
// not-yet-full team — only teams with an open slot are listed (a full team
// is never offered), same single-tap-to-pick pattern as SelectScorerModal.
export default function SelectJoinTeamModal({
  visible,
  onClose,
  teams,
  onSelect,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  teams: JoinableTeam[];
  onSelect: (teamId: string) => void;
  submitting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [pickingId, setPickingId] = useState<string | null>(null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-surface rounded-t-3xl"
          style={{ paddingBottom: 20 + insets.bottom, maxHeight: "75%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          <View className="flex-row items-start justify-between px-5 pt-3 pb-4">
            <View className="flex-1">
              <Text className="text-ink font-extrabold" style={{ fontSize: 22 }}>
                Join a Team
              </Text>
              <Text className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                Pick a team with an open slot to join
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{ width: 34, height: 34, backgroundColor: "#142533" }}
              hitSlop={6}
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }} bounces={false}>
            {teams.length === 0 ? (
              <Text className="text-muted text-sm text-center py-6">No teams with an open slot right now.</Text>
            ) : (
              teams.map((team) => {
                const isPicking = submitting && pickingId === team.id;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => {
                      setPickingId(team.id);
                      onSelect(team.id);
                    }}
                    disabled={submitting}
                    className="flex-row items-center rounded-2xl px-4 py-3 mb-2"
                    style={{ gap: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#0A1723" }}
                  >
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 36, height: 36, backgroundColor: "#142533" }}
                    >
                      <Text className="font-bold text-sm" style={{ color: colors.muted }}>
                        {team.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ fontSize: 14, color: colors.ink }} numberOfLines={1}>
                        {team.name}
                      </Text>
                      <Text className="text-muted text-xs" numberOfLines={1}>
                        {team.joinedCount}/{team.requiredSize || "—"} players
                      </Text>
                    </View>
                    {isPicking ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
