import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useLookupProfileByEmail, useAssignVenueAdmin, useRemoveVenueAdmin } from "../../hooks/useSuperadmin";
import type { AdminLookupResult } from "../../lib/api/superadmin";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";

type Route = RouteProp<SuperAdminStackParamList, "AssignAdmin">;
type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AssignAdmin">;

export default function AssignAdminScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const lookup = useLookupProfileByEmail();
  const assignAdmin = useAssignVenueAdmin(params.venueId);
  const removeAdmin = useRemoveVenueAdmin(params.venueId);

  const [email, setEmail] = useState("");
  const [result, setResult] = useState<AdminLookupResult | null | "not_searched">("not_searched");

  const handleLookup = () => {
    if (!email.trim()) return;
    lookup.mutate(email.trim(), {
      onSuccess: (profile) => setResult(profile),
      onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Lookup failed."),
    });
  };

  const handleAssign = () => {
    if (result === "not_searched" || !result) return;
    Alert.alert("Assign Admin", `Make "${result.full_name ?? result.email}" the admin of "${params.venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Assign",
        onPress: () =>
          assignAdmin.mutate(result.id, {
            onSuccess: () => navigation.replace("AdminDashboard", { venueId: params.venueId }),
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not assign admin."),
          }),
      },
    ]);
  };

  const handleRemove = () => {
    Alert.alert("Remove Admin", `Remove the current admin from "${params.venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeAdmin.mutate(undefined, {
            onSuccess: () => navigation.goBack(),
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not remove admin."),
          }),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          Assign Admin · {params.venueName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {params.currentAdminEmail ? (
          <View className="border border-border rounded-xl px-4 py-3 mb-6 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-muted text-xs">Current admin</Text>
              <Text className="text-ink font-medium text-sm mt-0.5">{params.currentAdminEmail}</Text>
            </View>
            <Pressable onPress={handleRemove} disabled={removeAdmin.isPending}>
              <Text className="text-danger text-sm font-semibold">Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View className="border border-dashed border-border rounded-xl px-4 py-3 mb-6">
            <Text className="text-muted text-sm">No admin assigned yet.</Text>
          </View>
        )}

        <Text className="text-muted text-xs font-semibold mb-1.5">Admin's Gmail</Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setResult("not_searched");
            }}
            placeholder="someone@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            className="flex-1 border border-border rounded-xl px-4 py-3 text-ink"
          />
          <Pressable
            onPress={handleLookup}
            disabled={lookup.isPending || !email.trim()}
            className="bg-primary rounded-xl px-4 items-center justify-center"
          >
            {lookup.isPending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-semibold text-sm">Look up</Text>}
          </Pressable>
        </View>

        {result && result !== "not_searched" && (
          <View className="border border-primary bg-primary-light rounded-xl px-4 py-3 mt-4 flex-row items-center">
            {result.avatar ? (
              <Image source={{ uri: result.avatar }} className="w-10 h-10 rounded-full mr-3" />
            ) : (
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3">
                <Text className="text-primary font-bold">{(result.full_name ?? "?").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View className="flex-1 mr-3">
              <Text className="text-ink font-semibold text-sm">{result.full_name || "No name set"}</Text>
              <Text className="text-muted text-xs mt-0.5">{result.email}</Text>
            </View>
            <Pressable onPress={handleAssign} disabled={assignAdmin.isPending} className="bg-primary rounded-lg px-3 py-2">
              {assignAdmin.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-semibold">Assign</Text>
              )}
            </Pressable>
          </View>
        )}

        {result === null && (
          <View className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 mt-4">
            <Text className="text-orange-700 text-sm">
              No account found for this email. Ask them to sign in with Google at least once, then try the lookup again.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
