import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, primaryButtonShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import AddMemberByIdField from "../../components/AddMemberByIdField";
import { useMyOwnedSquads, useSquadFillTournamentTeam } from "../../hooks/useSquadTeamFill";
import { useSquadDetail } from "../../hooks/useSquads";
import type { SquadListItem } from "../../lib/api/squads";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import { useAuthStore } from "../../store/authStore";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<GamesStackParamList, "AddTeam">;
type Nav = NativeStackNavigationProp<GamesStackParamList, "AddTeam">;

function MemberRow({ name, avatar }: { name: string | null; avatar: string | null }) {
  return (
    <View className="flex-row items-center border border-border rounded-xl px-3 py-2.5 mb-2" style={{ gap: 10 }}>
      {avatar ? (
        <Image source={{ uri: avatar }} className="w-9 h-9 rounded-full" />
      ) : (
        <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
          <Text className="text-primary font-bold text-xs">{(name ?? "?").charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
        {name ?? "Member"}
      </Text>
      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
    </View>
  );
}

// Entry point for the match card's "Add Team" button — claims one empty
// team slot with a complete squad in one shot, via the existing
// squad_fill_tournament_team RPC (useSquadFillTournamentTeam), which
// validates ownership/count/emptiness server-side regardless of what this
// screen shows. Three outcomes once a squad is picked, purely derived from
// its current active headcount vs. the match's required size — no separate
// step state to keep in sync:
//   count < required  → grow:   add players by ID until full
//   count === required → confirm: show the roster, one tap to lock it in
//   count > required  → pick:   check exactly `required` players, no more/fewer
export default function AddTeamScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);

  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(params.squadId ?? null);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

  const { data: ownedSquads, isLoading: squadsLoading } = useMyOwnedSquads(userId);
  const { data: squad, isLoading: squadLoading } = useSquadDetail(selectedSquadId ?? "");
  const squadFillTeam = useSquadFillTournamentTeam(params.gameId);

  const required = params.requiredSize;
  const excludeSet = new Set(params.excludeUserIds);
  const genderEligible = (s: SquadListItem) => params.gameGender === "mixed" || s.gender === params.gameGender;
  const eligibleCountFor = (s: SquadListItem) =>
    s.squad_members.filter((m) => m.status === "ACTIVE" && !excludeSet.has(m.user_id)).length;
  const teamSquads = (ownedSquads ?? []).filter((s) => s.group_type === "team");

  const handleSelectSquad = (id: string) => {
    setSelectedSquadId(id);
    setPickedIds(new Set());
  };

  const handleCreateTeam = () => {
    navigation.navigate("CreateSquad", {
      presetType: "team",
      lockType: true,
      returnTo: {
        gameId: params.gameId,
        teamId: params.teamId,
        requiredSize: params.requiredSize,
        excludeUserIds: params.excludeUserIds,
        gameGender: params.gameGender,
      },
    });
  };

  const handleBack = () => {
    // A squad the player picked from the list (not one they just created)
    // goes back to that list instead of leaving the screen entirely.
    if (selectedSquadId && !params.squadId) {
      setSelectedSquadId(null);
      setPickedIds(new Set());
    } else {
      navigation.goBack();
    }
  };

  const handleConfirm = (memberUserIds: string[]) => {
    if (!squad) return;
    squadFillTeam.mutate(
      { teamId: params.teamId, squadId: squad.id, memberUserIds, teamName: squad.name },
      {
        onSuccess: () => {
          Alert.alert("Team Added", `"${squad.name}" has been added to this match.`);
          navigation.navigate("GameDetail", { gameId: params.gameId });
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not register this team.")),
      }
    );
  };

  const togglePick = (memberId: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else if (next.size < required) {
        next.add(memberId);
      }
      return next;
    });
  };

  const activeMembers = squad
    ? squad.squad_members.filter((m) => m.status === "ACTIVE" && !excludeSet.has(m.user_id))
    : [];
  const hiddenCount = squad
    ? squad.squad_members.filter((m) => m.status === "ACTIVE" && excludeSet.has(m.user_id)).length
    : 0;
  const count = activeMembers.length;

  return (
    <View className="flex-1 bg-white">
      <GradientFill className="px-4 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center justify-center">
          <Pressable onPress={handleBack} hitSlop={10} style={{ position: "absolute", left: 0 }}>
            <Ionicons name={selectedSquadId && !params.squadId ? "arrow-back" : "close"} size={22} color="white" />
          </Pressable>
          <Text className="text-white text-base font-bold">Add Team</Text>
        </View>
      </GradientFill>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 32 + insets.bottom }}>
        {required <= 0 ? (
          <Text className="text-muted text-sm text-center mt-6">
            Team size isn't set for this match.
          </Text>
        ) : !selectedSquadId ? (
          <>
            <Text className="text-ink text-sm font-bold mb-3">Select one of your teams</Text>
            {squadsLoading ? (
              <ActivityIndicator color={colors.primary} className="mt-4" />
            ) : teamSquads.length === 0 ? (
              <View className="border border-dashed border-border rounded-xl p-6 items-center">
                <Ionicons name="people-outline" size={28} color={colors.border} />
                <Text className="text-muted text-sm text-center mt-2 mb-4">
                  You don't have a team yet.
                </Text>
                <Pressable onPress={handleCreateTeam} style={primaryButtonShadow}>
                  <GradientFill className="rounded-xl px-5 py-3">
                    <Text className="text-white font-bold text-sm">Create Team</Text>
                  </GradientFill>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {teamSquads.map((s) => {
                  const eligible = genderEligible(s);
                  const c = eligibleCountFor(s);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => eligible && handleSelectSquad(s.id)}
                      disabled={!eligible}
                      className="flex-row items-center rounded-xl px-3 py-2.5 border"
                      style={{ borderColor: colors.border, opacity: eligible ? 1 : 0.5, gap: 10 }}
                    >
                      <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                        <Text className="text-primary font-bold text-xs">{s.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text className="text-muted text-xs mt-0.5">
                          {eligible ? `${c}/${required} players` : `Open to ${params.gameGender} players only`}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  );
                })}
                <Pressable onPress={handleCreateTeam} className="items-center mt-2 py-2">
                  <Text className="text-primary font-semibold text-sm">+ Create a new team</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : squadLoading || !squad ? (
          <ActivityIndicator color={colors.primary} className="mt-4" />
        ) : (
          <>
            {hiddenCount > 0 && (
              <Text className="text-muted text-xs mb-3">
                {hiddenCount} member{hiddenCount === 1 ? "" : "s"} already playing for another team in this match{" "}
                {hiddenCount === 1 ? "isn't" : "aren't"} shown.
              </Text>
            )}

            {count < required ? (
              <>
                <Text className="text-ink font-bold text-base mb-1">Add Players to Your Team</Text>
                <Text className="text-muted text-sm mb-4">
                  {count}/{required} players added
                </Text>
                {activeMembers.map((m) => (
                  <MemberRow key={m.id} name={m.profiles?.full_name ?? null} avatar={m.profiles?.avatar ?? null} />
                ))}
                <View className="mt-3">
                  <AddMemberByIdField
                    squadId={squad.id}
                    excludeUserIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]}
                  />
                </View>
              </>
            ) : count === required ? (
              <>
                <Text className="text-ink font-bold text-base mb-1">Confirm Your Team</Text>
                <Text className="text-muted text-sm mb-4">
                  {squad.name} — {count}/{required} players
                </Text>
                {activeMembers.map((m) => (
                  <MemberRow key={m.id} name={m.profiles?.full_name ?? null} avatar={m.profiles?.avatar ?? null} />
                ))}
                <Pressable
                  onPress={() => handleConfirm(activeMembers.map((m) => m.user_id))}
                  disabled={squadFillTeam.isPending}
                  style={primaryButtonShadow}
                  className="mt-4"
                >
                  <GradientFill className="rounded-xl py-4 items-center">
                    {squadFillTeam.isPending ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-bold text-base">Confirm Team</Text>
                    )}
                  </GradientFill>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-ink font-bold text-base mb-1">Select Your Lineup</Text>
                <Text className="text-muted text-sm mb-4">
                  Select exactly {required} player{required === 1 ? "" : "s"} ({pickedIds.size}/{required} selected)
                </Text>
                {activeMembers.map((m) => {
                  const selected = pickedIds.has(m.user_id);
                  const name = m.profiles?.full_name ?? "Member";
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => togglePick(m.user_id)}
                      className="flex-row items-center border rounded-xl px-3 py-2.5 mb-2"
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
                <Pressable
                  onPress={() => handleConfirm(Array.from(pickedIds))}
                  disabled={pickedIds.size !== required || squadFillTeam.isPending}
                  style={pickedIds.size === required ? primaryButtonShadow : undefined}
                  className="mt-2"
                >
                  {pickedIds.size === required ? (
                    <GradientFill className="rounded-xl py-4 items-center">
                      {squadFillTeam.isPending ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-white font-bold text-base">Confirm Team</Text>
                      )}
                    </GradientFill>
                  ) : (
                    <View className="rounded-xl py-4 items-center bg-gray-200">
                      <Text className="text-muted font-bold text-base">Confirm Team</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
