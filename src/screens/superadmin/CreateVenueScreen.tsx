import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCreateVenue } from "../../hooks/useSuperadmin";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";
import FieldInput from "../../components/FieldInput";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

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
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create venue.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Create Venue</Text>
        <Pressable
          onPress={handleCreate}
          disabled={createVenue.isPending}
          className="bg-primary rounded-xl px-4 py-2"
          style={primaryButtonShadow}
        >
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
        <FieldInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Elite Sports Arena"
          containerStyle={{ marginBottom: 16 }}
          maxLength={80}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Description</Text>
        <FieldInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this venue..."
          multiline
          numberOfLines={3}
          maxLength={500}
          style={{ height: 88, textAlignVertical: "top" }}
          containerStyle={{ marginBottom: 16 }}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Address</Text>
        <FieldInput
          value={address}
          onChangeText={setAddress}
          placeholder="Street address"
          containerStyle={{ marginBottom: 16 }}
          maxLength={200}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">City</Text>
        <FieldInput
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Karachi"
          containerStyle={{ marginBottom: 16 }}
          maxLength={60}
        />

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Opens (HH:MM)</Text>
            <FieldInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="06:00"
              containerStyle={{ marginBottom: 16 }}
              maxLength={5}
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Closes (HH:MM)</Text>
            <FieldInput
              value={endTime}
              onChangeText={setEndTime}
              placeholder="23:00"
              containerStyle={{ marginBottom: 16 }}
              maxLength={5}
            />
          </View>
        </View>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Latitude (optional)</Text>
            <FieldInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="24.8607"
              keyboardType="numbers-and-punctuation"
              containerStyle={{ marginBottom: 16 }}
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs font-semibold mb-1.5">Longitude (optional)</Text>
            <FieldInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="67.0011"
              keyboardType="numbers-and-punctuation"
              containerStyle={{ marginBottom: 16 }}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
