import { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, FlatList, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
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
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: squads, isLoading } = useSquads({ search: search || undefined });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        {/* "padding" on both platforms, same as CreateTeamModal — this
            sheet is bottom-anchored (justify-end) with an auto-focused
            field, so padding pushes it up above the keyboard instead of
            leaving it hidden behind it. */}
        <KeyboardAvoidingView behavior="padding">
          {/* Shadow points up (negative height) since this sheet rises
              from the bottom of the screen, same as CreateTeamModal. */}
          <View
            className="bg-surface rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">Invite a Squad</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text className="text-muted text-sm mb-2">
              Search for a squad and invite it to join — its owner completes the actual join once
              they see the invite.
            </Text>

            <SearchField
              value={search}
              onChangeText={setSearch}
              prefix="Search by "
              variants={["squad name"]}
              autoFocus
            />

            {isLoading ? (
              <ActivityIndicator color={colors.primary} className="mt-6 mb-6" />
            ) : (
              <FlatList
                data={squads ?? []}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 340, marginTop: 12 }}
                contentContainerStyle={{ gap: 8 }}
                keyboardShouldPersistTaps="handled"
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
                        style={alreadyInvited ? undefined : primaryButtonShadow}
                      >
                        {alreadyInvited ? (
                          <View className="rounded-lg px-3 py-2 bg-gray-100">
                            <Text className="text-xs font-semibold text-muted">Invited</Text>
                          </View>
                        ) : (
                          <GradientFill className="rounded-lg px-3 py-2">
                            <Text className="text-xs font-semibold text-jazba-white">Invite</Text>
                          </GradientFill>
                        )}
                      </Pressable>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
