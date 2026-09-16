import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, primaryButtonShadow } from "../constants/theme";
import { useMyOwnedSquads } from "../hooks/useSquadTeamFill";
import FieldInput from "./FieldInput";
import type { SquadListItem } from "../lib/api/squads";

// Full-screen "Select Team" flow for claiming one specific empty team slot
// (scoped to the card the user tapped): name the team, then register one of
// your own squads into it — mirrors SquadFillModal's squad/member picker,
// styled as a full page with a dark header instead of a bottom sheet.
export default function SelectTeamModal({
  visible,
  onClose,
  userId,
  requiredCount,
  defaultTeamName,
  submitting,
  isHost,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  requiredCount: number;
  defaultTeamName: string;
  submitting: boolean;
  // Whether the current user is the tournament/game host — purely to pick
  // which outcome message to show; approval branching itself happens
  // server-side regardless of what's shown here.
  isHost: boolean;
  onSubmit: (squadId: string, memberUserIds: string[], teamName: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: squads, isLoading } = useMyOwnedSquads(userId);
  const [teamName, setTeamName] = useState(defaultTeamName);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const eligibleSquads = (squads ?? []).filter(
    (s) => s.squad_members.filter((m) => m.status === "ACTIVE").length >= requiredCount
  );

  useEffect(() => {
    if (visible) {
      setTeamName(defaultTeamName);
    } else {
      setSelectedSquad(null);
      setSelectedMemberIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultTeamName]);

  useEffect(() => {
    if (visible && eligibleSquads.length === 1 && !selectedSquad) {
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

  const canSubmit = !!teamName.trim() && !!selectedSquad && selectedMemberIds.size === requiredCount;

  const handleSubmit = () => {
    if (!canSubmit || !selectedSquad) return;
    onSubmit(selectedSquad.id, Array.from(selectedMemberIds), teamName.trim());
  };

  const activeMembers = selectedSquad
    ? selectedSquad.squad_members.filter((m) => m.status === "ACTIVE")
    : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View
          className="px-4 pb-4"
          style={{ backgroundColor: "#0E4429", paddingTop: insets.top + 12 }}
        >
          <View className="flex-row items-center justify-center">
            <Pressable onPress={onClose} hitSlop={10} style={{ position: "absolute", left: 0 }}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
            <Text className="text-white text-base font-bold">Select Team</Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 + insets.bottom }}>
          <Text className="text-ink text-sm font-bold mb-2">Team Name</Text>
          <FieldInput value={teamName} onChangeText={setTeamName} placeholder="e.g. Thunder Strikers" maxLength={60} />

          <Text className="text-muted text-xs font-semibold mt-6 mb-2">
            Select one from your existing squads
          </Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-4" />
          ) : eligibleSquads.length === 0 ? (
            <Text className="text-muted text-sm">
              You don't own a squad with at least {requiredCount} active member{requiredCount === 1 ? "" : "s"}.
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
                Select exactly {requiredCount} member{requiredCount === 1 ? "" : "s"} ({selectedMemberIds.size}/
                {requiredCount} selected)
              </Text>
              <View style={{ gap: 8 }}>
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
              </View>
            </>
          )}

          <Text className="text-muted text-xs text-center mt-6">
            {isHost
              ? "You're the host, so this team is added to the tournament immediately."
              : "This team will be sent to the host for approval before it's added."}
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
                CREATE NEW TEAM
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
