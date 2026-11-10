import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import Image from "./images/OptimizedImage";
import { primaryButtonShadow } from "../constants/theme";
import FieldInput from "./FieldInput";
import GradientFill from "./GradientFill";
import { useLookupProfileByUserCode, useAddSquadMemberDirect } from "../hooks/useSquads";
import type { UserCodeLookupResult } from "../lib/api/squads";
import { getFriendlyErrorMessage } from "../lib/friendlyError";

// Shared "type a player's ID, add them instantly" building block — no
// invite/accept step, a successful add goes straight into squad_members as
// ACTIVE (see addSquadMemberDirect). Reused both inside AddMemberByIdModal's
// bottom sheet (SquadDetailScreen) and inline in AddTeamScreen's
// add-until-full flow.
export default function AddMemberByIdField({
  squadId,
  excludeUserIds,
  disabledReason,
  onAdded,
}: {
  squadId: string;
  // Already-in-the-group ids — blocks a redundant add client-side with a
  // friendly message instead of waiting on the unique-index error.
  excludeUserIds: string[];
  // When set, replaces the input with this message instead (e.g. the group
  // is already full) — the lookup/add controls aren't shown at all.
  disabledReason?: string;
  onAdded?: (profile: UserCodeLookupResult) => void;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<UserCodeLookupResult | null | "not_searched">("not_searched");
  const lookup = useLookupProfileByUserCode();
  const addDirect = useAddSquadMemberDirect(squadId);

  const handleLookup = () => {
    if (!code.trim()) return;
    lookup.mutate(code.trim(), {
      onSuccess: (profile) => setResult(profile),
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Lookup failed.")),
    });
  };

  const handleAdd = () => {
    if (result === "not_searched" || !result) return;
    if (excludeUserIds.includes(result.id)) {
      Alert.alert("Already Added", `${result.full_name ?? "This player"} is already in this squad.`);
      return;
    }
    addDirect.mutate(result.id, {
      onSuccess: () => {
        onAdded?.(result);
        setCode("");
        setResult("not_searched");
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add this player.")),
    });
  };

  if (disabledReason) {
    return (
      <View className="border border-dashed border-border rounded-xl px-4 py-3">
        <Text className="text-muted text-sm text-center">{disabledReason}</Text>
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row" style={{ gap: 8 }}>
        <View className="flex-1">
          <FieldInput
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setResult("not_searched");
            }}
            placeholder="Enter player ID (e.g. AB12CD)"
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={handleLookup} disabled={lookup.isPending || !code.trim()} style={primaryButtonShadow}>
          <GradientFill
            className="rounded-2xl px-5 items-center justify-center"
            style={{ paddingVertical: 12 }}
          >
            {lookup.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-jazba-white font-bold text-sm">Find</Text>
            )}
          </GradientFill>
        </Pressable>
      </View>

      {result && result !== "not_searched" && (
        <View className="border border-primary bg-primary-light rounded-xl px-4 py-3 mt-3 flex-row items-center">
          {result.avatar ? (
            <Image source={{ uri: result.avatar }} className="w-10 h-10 rounded-full mr-3" />
          ) : (
            <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
              <Text className="text-primary font-bold">{(result.full_name ?? "?").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View className="flex-1 mr-3">
            <Text className="text-ink font-semibold text-sm">{result.full_name || "No name set"}</Text>
            <Text className="text-muted text-xs mt-0.5">ID: {result.user_code}</Text>
          </View>
          <Pressable onPress={handleAdd} disabled={addDirect.isPending}>
            <GradientFill className="rounded-lg px-3 py-2">
              {addDirect.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-jazba-white text-xs font-semibold">Add</Text>
              )}
            </GradientFill>
          </Pressable>
        </View>
      )}
      {result === null && (
        <View className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 mt-3">
          <Text className="text-orange-700 text-sm">No player found with that ID. Double check and try again.</Text>
        </View>
      )}
    </View>
  );
}
