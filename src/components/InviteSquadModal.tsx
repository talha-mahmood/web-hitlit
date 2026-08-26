import { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { useSquads } from "../hooks/useSquads";
import SearchField from "./SearchField";

// Host-only: search all squads and send an invite to one. Purely a
// notification — the squad owner still completes the actual join/fill
// themselves once they see it.
export default function InviteSquadModal({
  visible,
  onClose,
  submitting,
  alreadyInvitedSquadIds,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  submitting: boolean;
  alreadyInvitedSquadIds: string[];
  onInvite: (squadId: string, squadName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: squads, isLoading } = useSquads({ search: search || undefined });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 32, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-ink">Invite a Squad</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <SearchField value={search} onChangeText={setSearch} prefix="Search by " variants={["squad name"]} />

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-6 mb-6" />
          ) : (
            <FlatList
              data={squads ?? []}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 340, marginTop: 12 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text className="text-muted text-sm text-center mt-4">No squads found.</Text>
              }
              renderItem={({ item }) => {
                const alreadyInvited = alreadyInvitedSquadIds.includes(item.id);
                return (
                  <View className="flex-row items-center border border-border rounded-xl px-3 py-2.5" style={{ gap: 10 }}>
                    <View className="flex-1">
                      <Text className="text-ink text-sm font-medium" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                        {item.squad_members.filter((m) => m.status === "ACTIVE").length} active members
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onInvite(item.id, item.name)}
                      disabled={submitting || alreadyInvited}
                      className={`rounded-lg px-3 py-2 ${alreadyInvited ? "bg-gray-100" : "bg-primary"}`}
                      style={alreadyInvited ? undefined : primaryButtonShadow}
                    >
                      <Text className={`text-xs font-semibold ${alreadyInvited ? "text-muted" : "text-white"}`}>
                        {alreadyInvited ? "Invited" : "Invite"}
                      </Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
