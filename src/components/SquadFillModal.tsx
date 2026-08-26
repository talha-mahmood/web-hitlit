import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import { useMyOwnedSquads } from "../hooks/useSquadTeamFill";
import type { SquadListItem } from "../lib/api/squads";

// Shared by both "fill an empty tournament team" and "fill a regular game's
// open slots with a squad" — same rule either way: the squad owner must
// select *exactly* `requiredCount` currently-active squad members, no more
// no less (the RPC re-validates this server-side regardless).
export default function SquadFillModal({
  visible,
  onClose,
  userId,
  requiredCount,
  submitting,
  title = "Fill With Your Squad",
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  requiredCount: number;
  submitting: boolean;
  title?: string;
  onSubmit: (squadId: string, memberUserIds: string[]) => void;
}) {
  const { data: squads, isLoading } = useMyOwnedSquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const eligibleSquads = (squads ?? []).filter(
    (s) => s.squad_members.filter((m) => m.status === "ACTIVE").length >= requiredCount
  );

  useEffect(() => {
    if (!visible) {
      setSelectedSquad(null);
      setSelectedMemberIds(new Set());
    } else if (eligibleSquads.length === 1 && !selectedSquad) {
      setSelectedSquad(eligibleSquads[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, eligibleSquads.length]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < requiredCount) {
        next.add(id);
      }
      return next;
    });
  };

  const canSubmit = !!selectedSquad && selectedMemberIds.size === requiredCount;

  const handleSubmit = () => {
    if (!canSubmit || !selectedSquad) return;
    onSubmit(selectedSquad.id, Array.from(selectedMemberIds));
  };

  const activeMembers = selectedSquad
    ? selectedSquad.squad_members.filter((m) => m.status === "ACTIVE")
    : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 32, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-ink flex-1" numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-6 mb-6" />
          ) : eligibleSquads.length === 0 ? (
            <Text className="text-muted text-sm mt-3 mb-2">
              You don't own a squad with at least {requiredCount} active member{requiredCount === 1 ? "" : "s"}.
            </Text>
          ) : (
            <>
              {eligibleSquads.length > 1 && (
                <>
                  <Text className="text-muted text-xs font-semibold mt-2 mb-2">Choose a Squad</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                  >
                    {eligibleSquads.map((s) => {
                      const selected = selectedSquad?.id === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            setSelectedSquad(s);
                            setSelectedMemberIds(new Set());
                          }}
                          className="rounded-xl px-3 py-2"
                          style={{
                            borderWidth: 1.5,
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : "white",
                          }}
                        >
                          <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {selectedSquad && (
                <>
                  <Text className="text-muted text-xs font-semibold mt-4 mb-2">
                    Select exactly {requiredCount} member{requiredCount === 1 ? "" : "s"} ({selectedMemberIds.size}/
                    {requiredCount} selected)
                  </Text>
                  <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
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
                </>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
                className={`rounded-xl py-4 items-center mt-6 ${canSubmit ? "bg-primary" : "bg-gray-200"}`}
                style={canSubmit ? primaryButtonShadow : undefined}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className={`font-semibold text-base ${canSubmit ? "text-white" : "text-muted"}`}>
                    Register {requiredCount} Member{requiredCount === 1 ? "" : "s"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
