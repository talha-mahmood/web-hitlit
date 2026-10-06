import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { useAuthStore } from "../store/authStore";
import { useMySquads } from "../hooks/useSquadTeamFill";
import type { SquadListItem } from "../lib/api/squads";

// Lets a host fill in a scorecard match's player name fields from a group
// they belong to instead of typing each one by hand. Purely a text
// shortcut — it fills the same free-text name fields a manually typed name
// would, not a real invite/membership link like SelectTeamModal/
// SquadFillModal use for tournament team registration.
export default function AddPlayersFromGroupModal({
  visible,
  onClose,
  onAdd,
  existingNames,
  maxSelect = Infinity,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (names: string[]) => void;
  // Names already in the list (matched case-insensitively) — shown but
  // can't be picked again, so the same person never ends up listed twice.
  existingNames: string[];
  // How many more names the caller can actually accept right now — e.g. 1
  // for a singles player field, or however many empty doubles slots are
  // left. Left unlimited for a free-form roster like cricket/football.
  maxSelect?: number;
}) {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: squads, isLoading } = useMySquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setSelectedSquad(null);
      setSelectedIds(new Set());
    } else if ((squads ?? []).length === 1 && !selectedSquad) {
      setSelectedSquad(squads![0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, squads?.length]);

  const existingLower = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const activeMembers = (selectedSquad?.squad_members ?? []).filter((m) => m.status === "ACTIVE");

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelect) {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    const names = activeMembers
      .filter((m) => selectedIds.has(m.id))
      .map((m) => m.profiles?.full_name?.trim())
      .filter((n): n is string => !!n);
    if (names.length === 0) return;
    onAdd(names);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 32 + insets.bottom, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-ink flex-1" numberOfLines={1}>
              Add From a Group
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-6 mb-6" />
          ) : (squads ?? []).length === 0 ? (
            <Text className="text-muted text-sm mt-4 mb-2">
              You're not in any groups yet — join or create one to add players from it here.
            </Text>
          ) : (
            <>
              <Text className="text-muted text-xs font-semibold mt-2 mb-2">Choose a Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {(squads ?? []).map((s) => {
                  const selected = selectedSquad?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        setSelectedSquad(s);
                        setSelectedIds(new Set());
                      }}
                      className="rounded-xl px-3 py-2"
                      style={{
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : "white",
                      }}
                    >
                      <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{s.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {selectedSquad && (
                <>
                  <Text className="text-muted text-xs font-semibold mt-4 mb-2">
                    {maxSelect === Infinity
                      ? `Select players to add (${selectedIds.size} selected)`
                      : `Select up to ${maxSelect} (${selectedIds.size}/${maxSelect} selected)`}
                  </Text>
                  {activeMembers.length === 0 ? (
                    <Text className="text-muted text-sm mb-2">This group has no active members.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
                      {activeMembers.map((m) => {
                        const name = m.profiles?.full_name?.trim() ?? "";
                        const alreadyAdded = !!name && existingLower.has(name.toLowerCase());
                        const selected = selectedIds.has(m.id);
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => !alreadyAdded && toggleMember(m.id)}
                            disabled={alreadyAdded}
                            className="flex-row items-center border rounded-xl px-3 py-2.5"
                            style={{
                              borderColor: selected ? colors.primary : colors.border,
                              gap: 10,
                              opacity: alreadyAdded ? 0.5 : 1,
                            }}
                          >
                            {m.profiles?.avatar ? (
                              <Image source={{ uri: m.profiles.avatar }} className="w-9 h-9 rounded-full" />
                            ) : (
                              <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                                <Text className="text-primary font-bold text-xs">{(name || "?").charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                              {name || "Unnamed player"}
                            </Text>
                            {alreadyAdded ? (
                              <Text className="text-muted text-xs">Added</Text>
                            ) : (
                              <Ionicons
                                name={selected ? "checkmark-circle" : "ellipse-outline"}
                                size={22}
                                color={selected ? colors.primary : colors.border}
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  <Pressable
                    onPress={handleAdd}
                    disabled={selectedIds.size === 0}
                    className={`rounded-xl py-4 items-center mt-6 ${selectedIds.size > 0 ? "bg-primary" : "bg-gray-200"}`}
                    style={selectedIds.size > 0 ? primaryButtonShadow : undefined}
                  >
                    <Text className={`font-semibold text-base ${selectedIds.size > 0 ? "text-white" : "text-muted"}`}>
                      Add {selectedIds.size > 0 ? selectedIds.size : ""} Player{selectedIds.size === 1 ? "" : "s"}
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
