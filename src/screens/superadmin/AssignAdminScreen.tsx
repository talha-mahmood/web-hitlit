import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  useLookupProfileByEmail,
  useAssignVenueAdmin,
  useRemoveVenueAdmin,
  useVenueAdmins,
  useGrantVenueAdmin,
  useRevokeVenueAdminAccess,
} from "../../hooks/useSuperadmin";
import type { AdminLookupResult } from "../../lib/api/superadmin";
import { colors, primaryButtonShadow } from "../../constants/theme";
import FieldInput from "../../components/FieldInput";
import GradientFill from "../../components/GradientFill";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<VenueEditingParamList, "AssignAdmin">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "AssignAdmin">;

function EmailLookupRow({
  email,
  setEmail,
  onLookup,
  isLoading,
}: {
  email: string;
  setEmail: (v: string) => void;
  onLookup: () => void;
  isLoading: boolean;
}) {
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      <View className="flex-1">
        <FieldInput
          value={email}
          onChangeText={setEmail}
          placeholder="someone@gmail.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      <Pressable
        onPress={onLookup}
        disabled={isLoading || !email.trim()}
        style={primaryButtonShadow}
      >
        <GradientFill className="rounded-xl px-4 items-center justify-center">
          {isLoading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-jazba-white font-semibold text-sm">Look up</Text>}
        </GradientFill>
      </Pressable>
    </View>
  );
}

function LookupResultCard({
  result,
  onConfirm,
  submitting,
  confirmLabel,
}: {
  result: AdminLookupResult;
  onConfirm: () => void;
  submitting: boolean;
  confirmLabel: string;
}) {
  return (
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
        <Text className="text-muted text-xs mt-0.5">{result.email}</Text>
      </View>
      <Pressable onPress={onConfirm} disabled={submitting}>
        <GradientFill className="rounded-lg px-3 py-2">
          {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-jazba-white text-xs font-semibold">{confirmLabel}</Text>}
        </GradientFill>
      </Pressable>
    </View>
  );
}

export default function AssignAdminScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const ownerLookup = useLookupProfileByEmail();
  const assignOwner = useAssignVenueAdmin(params.venueId);
  const removeOwner = useRemoveVenueAdmin(params.venueId);

  const { data: extraAdmins, isLoading: extraAdminsLoading, error: extraAdminsError } = useVenueAdmins(params.venueId);
  const extraAdminLookup = useLookupProfileByEmail();
  const grantAdmin = useGrantVenueAdmin(params.venueId);
  const revokeAdmin = useRevokeVenueAdminAccess(params.venueId);

  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerResult, setOwnerResult] = useState<AdminLookupResult | null | "not_searched">("not_searched");

  const [extraEmail, setExtraEmail] = useState("");
  const [extraResult, setExtraResult] = useState<AdminLookupResult | null | "not_searched">("not_searched");

  const handleOwnerLookup = () => {
    if (!ownerEmail.trim()) return;
    ownerLookup.mutate(ownerEmail.trim(), {
      onSuccess: (profile) => setOwnerResult(profile),
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Lookup failed.")),
    });
  };

  const handleAssignOwner = () => {
    if (ownerResult === "not_searched" || !ownerResult) return;
    Alert.alert("Assign Owner", `Make "${ownerResult.full_name ?? ownerResult.email}" the owner of "${params.venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Assign",
        onPress: () =>
          assignOwner.mutate(ownerResult.id, {
            onSuccess: () => navigation.replace("AdminDashboard", { venueId: params.venueId }),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not assign owner.")),
          }),
      },
    ]);
  };

  const handleRemoveOwner = () => {
    Alert.alert("Remove Owner", `Remove the current owner from "${params.venueName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeOwner.mutate(undefined, {
            onSuccess: () => navigation.goBack(),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove owner.")),
          }),
      },
    ]);
  };

  const handleExtraLookup = () => {
    if (!extraEmail.trim()) return;
    extraAdminLookup.mutate(extraEmail.trim(), {
      onSuccess: (profile) => setExtraResult(profile),
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Lookup failed.")),
    });
  };

  const handleGrantAdmin = () => {
    if (extraResult === "not_searched" || !extraResult) return;
    grantAdmin.mutate(extraResult.id, {
      onSuccess: () => {
        setExtraEmail("");
        setExtraResult("not_searched");
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add admin.")),
    });
  };

  const handleRevokeAdmin = (userId: string, name: string) => {
    Alert.alert("Remove Admin", `Remove admin access for "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          revokeAdmin.mutate(userId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove admin.")),
          }),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1" numberOfLines={1}>
          Manage Admins · {params.venueName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {!params.hideOwnerTransfer && (
          <>
            {/* Primary owner — exactly one per venue, unchanged behavior */}
            <Text className="text-ink font-bold text-base mb-1">Owner</Text>
            <Text className="text-muted text-xs mb-3">
              The primary owner. Only they (or you) can manage this venue's additional admins below.
            </Text>

            {params.currentAdminEmail ? (
              <View className="border border-border rounded-xl px-4 py-3 mb-6 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-muted text-xs">Current owner</Text>
                  <Text className="text-ink font-medium text-sm mt-0.5">{params.currentAdminEmail}</Text>
                </View>
                <Pressable onPress={handleRemoveOwner} disabled={removeOwner.isPending}>
                  <Text className="text-danger text-sm font-semibold">Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View className="border border-dashed border-border rounded-xl px-4 py-3 mb-4">
                <Text className="text-muted text-sm">No owner assigned yet.</Text>
              </View>
            )}

            {!params.currentAdminEmail && (
              <>
                <Text className="text-muted text-xs font-semibold mb-1.5">Owner's Gmail</Text>
                <EmailLookupRow
                  email={ownerEmail}
                  setEmail={(t) => {
                    setOwnerEmail(t);
                    setOwnerResult("not_searched");
                  }}
                  onLookup={handleOwnerLookup}
                  isLoading={ownerLookup.isPending}
                />
                {ownerResult && ownerResult !== "not_searched" && (
                  <LookupResultCard
                    result={ownerResult}
                    onConfirm={handleAssignOwner}
                    submitting={assignOwner.isPending}
                    confirmLabel="Assign"
                  />
                )}
                {ownerResult === null && (
                  <View className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 mt-3">
                    <Text className="text-orange-700 text-sm">
                      No account found for this email. Ask them to sign in with Google at least once, then try again.
                    </Text>
                  </View>
                )}
                <View className="h-6" />
              </>
            )}
          </>
        )}

        {/* Additional admins — any number, all with identical access to the venue */}
        <View className={params.hideOwnerTransfer ? "" : "border-t border-border pt-5 mt-2"}>
          <Text className="text-ink font-bold text-base mb-1">Additional Admins</Text>
          <Text className="text-muted text-xs mb-3">
            Extra people who can manage this venue (bookings, courts, pricing) alongside the owner. No limit on how many.
          </Text>

          {extraAdminsLoading ? (
            <ActivityIndicator color={colors.primary} className="mb-3" />
          ) : extraAdminsError ? (
            <View className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">
                {getFriendlyErrorMessage(extraAdminsError, "Could not load additional admins.")}
              </Text>
            </View>
          ) : (extraAdmins ?? []).length === 0 ? (
            <View className="border border-dashed border-border rounded-xl px-4 py-3 mb-4">
              <Text className="text-muted text-sm">No additional admins yet.</Text>
            </View>
          ) : (
            <View className="mb-4" style={{ gap: 8 }}>
              {extraAdmins!.map((admin) => (
                <View
                  key={admin.id}
                  className="flex-row items-center border border-border rounded-xl px-4 py-3"
                >
                  {admin.profiles?.avatar ? (
                    <Image source={{ uri: admin.profiles.avatar }} className="w-9 h-9 rounded-full mr-3" />
                  ) : (
                    <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center mr-3">
                      <Text className="text-primary font-bold text-xs">
                        {(admin.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 mr-3">
                    <Text className="text-ink font-medium text-sm" numberOfLines={1}>
                      {admin.profiles?.full_name || "No name set"}
                    </Text>
                    <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                      {admin.profiles?.email}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRevokeAdmin(admin.user_id, admin.profiles?.full_name ?? admin.profiles?.email ?? "this admin")}
                    disabled={revokeAdmin.isPending}
                    hitSlop={8}
                  >
                    <Text className="text-danger text-sm font-semibold">Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text className="text-muted text-xs font-semibold mb-1.5">Add Admin by Gmail</Text>
          <EmailLookupRow
            email={extraEmail}
            setEmail={(t) => {
              setExtraEmail(t);
              setExtraResult("not_searched");
            }}
            onLookup={handleExtraLookup}
            isLoading={extraAdminLookup.isPending}
          />
          {extraResult && extraResult !== "not_searched" && (
            <LookupResultCard
              result={extraResult}
              onConfirm={handleGrantAdmin}
              submitting={grantAdmin.isPending}
              confirmLabel="Add"
            />
          )}
          {extraResult === null && (
            <View className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 mt-3">
              <Text className="text-orange-700 text-sm">
                No account found for this email. Ask them to sign in with Google at least once, then try again.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
