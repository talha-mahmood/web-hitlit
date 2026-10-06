import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, primaryButtonShadow } from "../constants/theme";
import { useMySquads } from "../hooks/useSquadTeamFill";
import type { SquadListItem } from "../lib/api/squads";
import type { Database } from "../types/database.types";

type Gender = Database["public"]["Enums"]["game_gender_type"];

// Full-screen "Fill With My Squad" flow for one specific, still-forming team
// card — unlike SelectTeamModal (which registers a whole squad into a brand
// new, empty team in one instant step), this sends each hand-picked squad
// member their own individual team invite (see FillTeamWithSquadModal's
// caller) — they show up in the team once they accept it from Notifications,
// same as "Invite a Player" for a single searched user.
export default function FillTeamWithSquadModal({
  visible,
  onClose,
  userId,
  remainingSlots,
  submitting,
  excludeUserIds,
  gameGender,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  // Open slots left on this team — caps how many members can be picked, but
  // isn't strictly enforced server-side (each invite is independent; the
  // roster-lock trigger is what actually stops the team from overfilling).
  remainingSlots: number;
  submitting: boolean;
  // Players already JOINED on another team in this same tournament — hidden
  // from the picker, same reasoning as SelectTeamModal.
  excludeUserIds: string[];
  gameGender: Gender;
  onSubmit: (memberUserIds: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: squads, isLoading } = useMySquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const excludeSet = new Set(excludeUserIds);
  const availableMembers = (s: SquadListItem) =>
    s.squad_members.filter((m) => m.status === "ACTIVE" && !excludeSet.has(m.user_id));
  const genderEligible = (s: SquadListItem) => gameGender === "mixed" || s.gender === gameGender;
  const eligibleSquads = (squads ?? []).filter((s) => availableMembers(s).length > 0 && genderEligible(s));

  useEffect(() => {
    if (!visible) {
      setSelectedSquad(null);
      setSelectedMemberIds(new Set());
    }
  }, [visible]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < remainingSlots) {
        next.add(id);
      }
      return next;
    });
  };

  const canSubmit = selectedMemberIds.size > 0;
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(Array.from(selectedMemberIds));
  };

  const activeMembers = selectedSquad ? availableMembers(selectedSquad) : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-4 pb-4" style={{ backgroundColor: "#0E4429", paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center justify-center">
            <Pressable onPress={onClose} hitSlop={10} style={{ position: "absolute", left: 0 }}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
            <Text className="text-white text-base font-bold">Fill With My Group</Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 + insets.bottom }}>
          <Text className="text-muted text-xs font-semibold mb-2">Select a group</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-4" />
          ) : eligibleSquads.length === 0 ? (
            <Text className="text-muted text-sm">
              You don't have a group with an eligible member to invite right now.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {eligibleSquads.map((s) => {
                const selected = selectedSquad?.id === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setSelectedSquad(s);
                      setSelectedMemberIds(new Set());
                    }}
                    className="flex-row items-center rounded-xl px-3 py-2.5"
                    style={{
                      borderWidth: 1.5,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : "white",
                      gap: 10,
                    }}
                  >
                    <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                      <Text className="text-primary font-bold text-xs">{s.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text className="text-ink text-sm font-semibold flex-1 uppercase" numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selected ? colors.primary : colors.border}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedSquad && (
            <>
              <Text className="text-muted text-xs font-semibold mt-6 mb-2">
                Select up to {remainingSlots} member{remainingSlots === 1 ? "" : "s"} to invite (
                {selectedMemberIds.size}/{remainingSlots} selected)
              </Text>
              <View style={activeMembers.length > 6 ? { maxHeight: 6 * 52 + 5 * 8 } : undefined}>
                <ScrollView
                  contentContainerStyle={{ gap: 8 }}
                  scrollEnabled={activeMembers.length > 6}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={activeMembers.length > 6}
                >
                  {activeMembers.map((m) => {
                    const selected = selectedMemberIds.has(m.user_id);
                    const name = m.profiles?.full_name ?? "Member";
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => toggleMember(m.user_id)}
                        className="flex-row items-center border rounded-xl px-3 py-2.5"
                        style={{ borderColor: selected ? colors.primary : colors.border, gap: 10 }}
                      >
                        {m.profiles?.avatar ? (
                          <Image source={{ uri: m.profiles.avatar }} className="w-9 h-9 rounded-full" />
                        ) : (
                          <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                            <Text className="text-primary font-bold text-xs">{name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                          {name}
                        </Text>
                        <Ionicons
                          name={selected ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={selected ? colors.primary : colors.border}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}

          <Text className="text-muted text-xs text-center mt-6">
            Each selected player gets their own request — they join once they approve it from Notifications.
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`rounded-xl py-4 items-center mt-4 ${canSubmit ? "bg-primary" : "bg-gray-200"}`}
            style={canSubmit ? primaryButtonShadow : undefined}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`font-semibold text-base ${canSubmit ? "text-white" : "text-muted"}`}>
                SEND {selectedMemberIds.size > 0 ? `(${selectedMemberIds.size})` : ""} REQUEST
                {selectedMemberIds.size === 1 ? "" : "S"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
