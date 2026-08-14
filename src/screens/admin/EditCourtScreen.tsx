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
import { useAdminVenueDetail, useAddCourt, useUpdateCourt } from "../../hooks/useVenuesAdmin";
import { useSports } from "../../hooks/useSports";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import FieldInput from "../../components/FieldInput";

type Route = RouteProp<VenueEditingParamList, "EditCourt">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "EditCourt">;

export default function EditCourtScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data: venue, isLoading } = useAdminVenueDetail(params.venueId);
  const { data: sports } = useSports();
  const addCourt = useAddCourt(params.venueId);
  const updateCourt = useUpdateCourt(params.venueId);

  const existingCourt = params.courtId ? venue?.court.find((c) => c.id === params.courtId) : undefined;
  const isEditing = !!params.courtId;

  const [name, setName] = useState("");
  const [sportsId, setSportsId] = useState<string | null>(null);
  const [pricePerHour, setPricePerHour] = useState("");
  const [capacity, setCapacity] = useState("");
  const [surfaceType, setSurfaceType] = useState("");
  const [isactive, setIsactive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && (existingCourt || !isEditing)) {
      if (existingCourt) {
        setName(existingCourt.name);
        setSportsId(existingCourt.sports_id);
        setPricePerHour(String(existingCourt.price_per_hour));
        setCapacity(existingCourt.capacity != null ? String(existingCourt.capacity) : "");
        setSurfaceType(existingCourt.surface_type ?? "");
        setIsactive(existingCourt.isactive);
      }
      setInitialized(true);
    }
  }, [existingCourt, isEditing, initialized]);

  const handleSave = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Court name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (!sportsId) {
      Alert.alert("Missing Info", "Please select a sport.");
      return;
    }
    const price = parseFloat(pricePerHour);
    if (!price || price <= 0) {
      Alert.alert("Missing Info", "Please enter a valid price per hour.");
      return;
    }

    const input = {
      name: name.trim(),
      sportsId,
      pricePerHour: price,
      capacity: capacity ? parseInt(capacity, 10) : null,
      surfaceType: surfaceType.trim(),
      isactive,
    };

    const mutation = isEditing
      ? updateCourt.mutateAsync({ courtId: params.courtId as string, input })
      : addCourt.mutateAsync(input);

    mutation
      .then(() => navigation.goBack())
      .catch((err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not save court."));
  };

  const isPending = addCourt.isPending || updateCourt.isPending;

  if (isLoading || (isEditing && !initialized)) {
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
        <Text className="text-base font-bold text-ink flex-1">{isEditing ? "Edit Court" : "Add Court"}</Text>
        <Pressable
          onPress={handleSave}
          disabled={isPending}
          className="bg-primary rounded-xl px-4 py-2"
          style={primaryButtonShadow}
        >
          {isPending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-semibold text-sm">Save</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-muted text-xs font-semibold mb-1.5">Court Name</Text>
        <FieldInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Court 1"
          containerStyle={{ marginBottom: 16 }}
          maxLength={60}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Sport</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 16 }}>
          {(sports ?? []).map((s) => {
            const selected = sportsId === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSportsId(s.id)}
                className="px-3 py-2 rounded-xl"
                style={{
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : "white",
                  ...(selected
                    ? {
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.2,
                        shadowRadius: 6,
                        elevation: 2,
                      }
                    : null),
                }}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{s.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text className="text-muted text-xs font-semibold mb-1.5">Price per Hour (Rs)</Text>
        <FieldInput
          value={pricePerHour}
          onChangeText={setPricePerHour}
          placeholder="e.g. 2000"
          keyboardType="numeric"
          containerStyle={{ marginBottom: 16 }}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Capacity (optional)</Text>
        <FieldInput
          value={capacity}
          onChangeText={setCapacity}
          placeholder="Max players"
          keyboardType="numeric"
          containerStyle={{ marginBottom: 16 }}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Surface Type (optional)</Text>
        <FieldInput
          value={surfaceType}
          onChangeText={setSurfaceType}
          placeholder="e.g. Artificial Turf"
          containerStyle={{ marginBottom: 16 }}
        />

        <View className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3">
          <View className="flex-1 mr-3">
            <Text className="text-ink font-medium">Active</Text>
            <Text className="text-muted text-xs mt-0.5">Turn off to hide this court from bookings.</Text>
          </View>
          <Switch value={isactive} onValueChange={setIsactive} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
