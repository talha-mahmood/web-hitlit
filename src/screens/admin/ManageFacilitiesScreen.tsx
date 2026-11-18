import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useAddFacility, useDeleteFacility } from "../../hooks/useVenuesAdmin";
import { colors, heroShadow, primaryButtonShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import FieldInput from "../../components/FieldInput";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";
import { SkeletonCardRows } from "../../components/Skeleton";

type Route = RouteProp<VenueEditingParamList, "ManageFacilities">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "ManageFacilities">;

export default function ManageFacilitiesScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const addFacility = useAddFacility(params.venueId);
  const deleteFacility = useDeleteFacility(params.venueId);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");

  const facilities = venue?.venue_facilities ?? [];

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter a facility name.");
      return;
    }
    addFacility.mutate(
      { name: name.trim(), type: type.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setShowAdd(false);
          setName("");
          setType("");
          setDescription("");
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add facility.")),
      }
    );
  };

  const handleDelete = (facilityId: string, facilityName: string) => {
    Alert.alert("Remove Facility", `Remove "${facilityName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          deleteFacility.mutate(facilityId, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove facility.")),
          }),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Amenities</Text>
        <Pressable onPress={() => setShowAdd(true)} style={primaryButtonShadow}>
          <GradientFill className="flex-row items-center rounded-lg px-3 py-1.5" style={{ gap: 4 }}>
            <Ionicons name="add" size={14} color="white" />
            <Text className="text-jazba-white text-xs font-semibold">Add</Text>
          </GradientFill>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}>
        {isLoading ? (
          <SkeletonCardRows />
        ) : facilities.length === 0 ? (
          <View className="border border-dashed border-border rounded-2xl p-8 items-center">
            <Ionicons name="sparkles-outline" size={32} color={colors.border} />
            <Text className="text-muted text-sm text-center mt-2">
              No amenities yet. Add things like parking, washrooms, or floodlights.
            </Text>
          </View>
        ) : (
          facilities.map((f) => (
            <View key={f.id} className="border border-border rounded-xl px-4 py-3 flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-ink font-medium text-sm">{f.name}</Text>
                {f.description ? <Text className="text-muted text-xs mt-0.5">{f.description}</Text> : null}
              </View>
              <Pressable onPress={() => handleDelete(f.id, f.name)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <KeyboardAvoidingView behavior="padding">
            {/* Shadow points up (negative height) since this sheet rises
                from the bottom of the screen. */}
            <View
              className="bg-surface rounded-t-3xl px-5 pt-5"
              style={{ paddingBottom: 32, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-ink">Add Amenity</Text>
                <Pressable onPress={() => setShowAdd(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>

              <Text className="text-muted text-xs font-semibold mb-1.5">Name</Text>
              <FieldInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Free Parking"
                containerStyle={{ marginBottom: 12 }}
                maxLength={60}
              />
              <Text className="text-muted text-xs font-semibold mb-1.5">Type (optional)</Text>
              <FieldInput
                value={type}
                onChangeText={setType}
                placeholder="e.g. parking"
                containerStyle={{ marginBottom: 12 }}
                maxLength={40}
              />
              <Text className="text-muted text-xs font-semibold mb-1.5">Description (optional)</Text>
              <FieldInput
                value={description}
                onChangeText={setDescription}
                placeholder="Extra details"
                containerStyle={{ marginBottom: 16 }}
                maxLength={200}
              />

              <Pressable onPress={handleAdd} disabled={addFacility.isPending} style={primaryButtonShadow}>
                <GradientFill className="rounded-xl py-4 items-center">
                  {addFacility.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-jazba-white font-semibold text-base">Add Amenity</Text>
                  )}
                </GradientFill>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
