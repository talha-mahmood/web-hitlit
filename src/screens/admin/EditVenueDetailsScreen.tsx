import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAdminVenueDetail, useUpdateVenue } from "../../hooks/useVenuesAdmin";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import FieldInput from "../../components/FieldInput";

type Route = RouteProp<VenueEditingParamList, "EditVenueDetails">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "EditVenueDetails">;

export default function EditVenueDetailsScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const updateVenue = useUpdateVenue(params.venueId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rulesAndPolicies, setRulesAndPolicies] = useState("");
  const [isactive, setIsactive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (venue && !initialized) {
      setName(venue.name ?? "");
      setDescription(venue.description ?? "");
      setAddress(venue.address ?? "");
      setCity(venue.city ?? "");
      setStartTime(venue.start_time?.slice(0, 5) ?? "");
      setEndTime(venue.end_time?.slice(0, 5) ?? "");
      setContactPhone(venue.contact_phone ?? "");
      setRulesAndPolicies(venue.rules_and_policies ?? "");
      setIsactive(venue.isactive);
      setInitialized(true);
    }
  }, [venue, initialized]);

  const handleSave = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Venue name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      Alert.alert("Invalid Time", "Start time must be in HH:MM format, e.g. 06:00.");
      return;
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert("Invalid Time", "End time must be in HH:MM format, e.g. 23:00.");
      return;
    }

    updateVenue.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        start_time: startTime || null,
        end_time: endTime || null,
        contact_phone: contactPhone.trim() || null,
        rules_and_policies: rulesAndPolicies.trim() || null,
        isactive,
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not save venue."),
      }
    );
  };

  if (isLoading || !initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Edit Venue</Text>
        <Pressable
          onPress={handleSave}
          disabled={updateVenue.isPending}
          className="bg-primary rounded-xl px-4 py-2"
          style={primaryButtonShadow}
        >
          {updateVenue.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Save</Text>
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
          placeholder="Describe your venue..."
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
              keyboardType="numbers-and-punctuation"
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
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <Text className="text-muted text-xs font-semibold mb-1.5">Contact Phone</Text>
        <FieldInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="e.g. 03001234567"
          keyboardType="phone-pad"
          containerStyle={{ marginBottom: 16 }}
          maxLength={20}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Rules & Policies</Text>
        <FieldInput
          value={rulesAndPolicies}
          onChangeText={setRulesAndPolicies}
          placeholder="e.g. Cancellations must be made 2 hours in advance. Proper sports shoes required."
          multiline
          numberOfLines={4}
          maxLength={1000}
          style={{ height: 100, textAlignVertical: "top" }}
          containerStyle={{ marginBottom: 16 }}
        />

        <View className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3">
          <View className="flex-1 mr-3">
            <Text className="text-ink font-medium">Open for bookings</Text>
            <Text className="text-muted text-xs mt-0.5">
              Turn off to temporarily hide this venue from customers.
            </Text>
          </View>
          <Switch
            value={isactive}
            onValueChange={setIsactive}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
