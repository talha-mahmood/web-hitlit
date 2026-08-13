import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCreateVenue } from "../../hooks/useSuperadmin";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "CreateVenue">;

export default function CreateVenueScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const createVenue = useCreateVenue();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("23:00");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const handleCreate = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Venue name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert("Invalid Time", "Operating hours must be in HH:MM format, e.g. 06:00.");
      return;
    }

    createVenue.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        startTime,
        endTime,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      {
        onSuccess: (venue) => {
          navigation.replace("AssignAdmin", { venueId: venue.id, venueName: venue.name, currentAdminEmail: null });
        },
        onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not create venue."),
      }
    );
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
        <Text className="text-base font-bold text-ink flex-1">Create Venue</Text>
        <Pressable onPress={handleCreate} disabled={createVenue.isPending} className="bg-primary rounded-xl px-4 py-2">
          {createVenue.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Create</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-muted text-xs font-semibold mb-1.5">Venue Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Elite Sports Arena"
          className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
          maxLength={80}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this venue..."
          multiline
          numberOfLines={3}
          maxLength={500}
          style={{ height: 88, textAlignVertical: "top" }}
          className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Street address"
          className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
          maxLength={200}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">City</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Karachi"
          className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
          maxLength={60}
        />

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Opens (HH:MM)</Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="06:00"
              className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
              maxLength={5}
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Closes (HH:MM)</Text>
            <TextInput
              value={endTime}
              onChangeText={setEndTime}
              placeholder="23:00"
              className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
              maxLength={5}
            />
          </View>
        </View>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Latitude (optional)</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="24.8607"
              keyboardType="numbers-and-punctuation"
              className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Longitude (optional)</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="67.0011"
              keyboardType="numbers-and-punctuation"
              className="border border-border rounded-xl px-4 py-3 text-ink mb-4"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
