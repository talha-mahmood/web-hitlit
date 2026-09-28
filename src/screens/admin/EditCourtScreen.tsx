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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useAdminVenueDetail,
  useAddCourt,
  useUpdateCourt,
  useCourtPriceRules,
  useAddCourtPriceRule,
  useDeleteCourtPriceRule,
} from "../../hooks/useVenuesAdmin";
import type { CourtPriceRule } from "../../lib/api/venuesAdmin";
import { useSports } from "../../hooks/useSports";
import { getSportIcon } from "../../lib/sportIcons";
import { getSportImage } from "../../lib/sportImages";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { AMENITY_OPTIONS } from "../../lib/amenities";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { VenueEditingParamList } from "../../navigation/adminTypes";
import FieldInput from "../../components/FieldInput";
import LocationPickerField from "../../components/LocationPickerField";
import SelectDropdownField from "../../components/SelectDropdownField";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Route = RouteProp<VenueEditingParamList, "EditCourt">;
type Nav = NativeStackNavigationProp<VenueEditingParamList, "EditCourt">;

const SURFACE_TYPE_OPTIONS = ["Artificial Turf", "Natural Grass", "Cement Turf", "Hybrid Turf", "Clay"];

// Accepts a 1- or 2-digit hour ("4:00" or "04:00") so the user doesn't have
// to remember to type a leading zero, and zero-pads it before use/storage.
const TIME_RE = /^\d{1,2}:\d{2}$/;

function normalizeTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function formatTime12h(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0], 10);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

function PriceRulesSection({ courtId }: { courtId: string }) {
  const { data: rules, isLoading } = useCourtPriceRules(courtId);
  const addRule = useAddCourtPriceRule(courtId);
  const deleteRule = useDeleteCourtPriceRule(courtId);

  const [ruleStart, setRuleStart] = useState("");
  const [ruleEnd, setRuleEnd] = useState("");
  const [rulePrice, setRulePrice] = useState("");

  const handleAddRule = () => {
    if (!TIME_RE.test(ruleStart) || !TIME_RE.test(ruleEnd)) {
      Alert.alert("Invalid Time", "Start and end time must be in HH:MM format, e.g. 6:00 or 06:00.");
      return;
    }
    const start = normalizeTime(ruleStart);
    const end = normalizeTime(ruleEnd);
    if (start >= end) {
      Alert.alert("Invalid Range", "Start time must be before end time.");
      return;
    }
    const price = parseFloat(rulePrice);
    if (!price || price <= 0) {
      Alert.alert("Missing Info", "Please enter a valid price per hour for this window.");
      return;
    }
    const overlaps = (rules ?? []).some((r) => start < r.end_time.slice(0, 5) && end > r.start_time.slice(0, 5));
    if (overlaps) {
      Alert.alert("Overlapping Window", "This time window overlaps with a rate you've already set.");
      return;
    }

    addRule.mutate(
      { startTime: start, endTime: end, pricePerHour: price },
      {
        onSuccess: () => {
          setRuleStart("");
          setRuleEnd("");
          setRulePrice("");
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add this rate.")),
      }
    );
  };

  const handleRemoveRule = (rule: CourtPriceRule) => {
    Alert.alert(
      "Remove Rate",
      `Remove the Rs ${rule.price_per_hour.toLocaleString()}/hr rate for ${formatTime12h(rule.start_time)} – ${formatTime12h(rule.end_time)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            deleteRule.mutate(rule.id, {
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove this rate.")),
            }),
        },
      ]
    );
  };

  return (
    <View className="mt-2">
      <Text className="text-muted text-xs font-semibold mb-1.5">Time-based Pricing (optional)</Text>
      <Text className="text-muted text-xs mb-3">
        Override the price above for specific time windows, e.g. 6:00 AM – 4:00 PM at Rs 100, 4:00 PM – 10:00 PM at
        Rs 200. Any hour without a window below uses the default price.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mb-3" />
      ) : rules && rules.length > 0 ? (
        <View className="mb-3">
          {rules.map((rule) => (
            <View
              key={rule.id}
              className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3 mb-2"
            >
              <Text className="text-ink text-sm font-medium">
                {formatTime12h(rule.start_time)} – {formatTime12h(rule.end_time)}
              </Text>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Text className="text-primary font-semibold text-sm">Rs {rule.price_per_hour.toLocaleString()}</Text>
                <Pressable onPress={() => handleRemoveRule(rule)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row" style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <FieldInput value={ruleStart} onChangeText={setRuleStart} placeholder="06:00" maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <FieldInput value={ruleEnd} onChangeText={setRuleEnd} placeholder="16:00" maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <FieldInput value={rulePrice} onChangeText={setRulePrice} placeholder="Rs" keyboardType="numeric" />
        </View>
      </View>
      <Pressable
        onPress={handleAddRule}
        disabled={addRule.isPending}
        className="border border-primary rounded-xl py-3 items-center mt-2"
      >
        {addRule.isPending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text className="text-primary font-semibold text-sm">Add Rate Window</Text>
        )}
      </Pressable>
    </View>
  );
}

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
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [isactive, setIsactive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const toggleAmenity = (label: string) => {
    setAmenities((prev) => (prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]));
  };

  useEffect(() => {
    if (!initialized && (existingCourt || !isEditing)) {
      if (existingCourt) {
        setName(existingCourt.name);
        setSportsId(existingCourt.sports_id);
        setPricePerHour(String(existingCourt.price_per_hour));
        setCapacity(existingCourt.capacity != null ? String(existingCourt.capacity) : "");
        setSurfaceType(existingCourt.surface_type ?? "");
        setDescription(existingCourt.description ?? "");
        setLocation(existingCourt.location ?? "");
        setAmenities(existingCourt.amenities ?? []);
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
      description: description.trim(),
      location: location.trim(),
      amenities,
      isactive,
    };

    const mutation = isEditing
      ? updateCourt.mutateAsync({ courtId: params.courtId as string, input })
      : addCourt.mutateAsync(input);

    mutation
      .then(() => navigation.goBack())
      .catch((err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save court.")));
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
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 20, paddingBottom: 480 }}
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
        {isEditing ? (
          // Locked after creation — changing it would strand any existing
          // bookings/players expecting this court's original sport (same
          // reasoning as games' sport field being fixed post-creation).
          (() => {
            const currentSport = (sports ?? []).find((s) => s.id === sportsId);
            const { icon, bg, fg } = getSportIcon(currentSport?.name ?? "");
            const photo = getSportImage(currentSport?.name ?? "");
            return (
              <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
                {photo ? (
                  <Image source={photo} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons name={icon} size={24} color={fg} />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-ink font-semibold text-sm">{currentSport?.name ?? "—"}</Text>
                  <Text className="text-muted text-xs mt-0.5">Sport can't be changed after a court is created.</Text>
                </View>
              </View>
            );
          })()
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 4, paddingHorizontal: 2 }} style={{ marginBottom: 16 }}>
            {(sports ?? []).map((s) => {
              const selected = sportsId === s.id;
              const { icon, bg, fg } = getSportIcon(s.name);
              const photo = getSportImage(s.name);
              return (
                <Pressable key={s.id} onPress={() => setSportsId(s.id)} className="items-center" style={{ width: 76 }}>
                  {photo ? (
                    <Image
                      source={photo}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 16,
                        borderWidth: selected ? 3 : 0,
                        borderColor: colors.primary,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 16,
                        backgroundColor: bg,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: selected ? 3 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <MaterialCommunityIcons name={icon} size={32} color={fg} />
                    </View>
                  )}
                  <Text
                    className="text-xs mt-2 text-center"
                    style={{ color: selected ? colors.primary : colors.ink, fontWeight: selected ? "700" : "500" }}
                    numberOfLines={1}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

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
        <View style={{ marginBottom: 16 }}>
          <SelectDropdownField
            value={surfaceType}
            options={SURFACE_TYPE_OPTIONS}
            onChange={setSurfaceType}
            placeholder="Select surface type"
          />
        </View>

        <Text className="text-muted text-xs font-semibold mb-1.5">Amenities (optional)</Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
          {AMENITY_OPTIONS.map(({ label, icon }) => {
            const selected = amenities.includes(label);
            return (
              <Pressable
                key={label}
                onPress={() => toggleAmenity(label)}
                className="flex-row items-center rounded-xl px-3 py-2.5"
                style={{
                  width: "47%",
                  gap: 8,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : "white",
                }}
              >
                <MaterialCommunityIcons name={icon} size={20} color={selected ? colors.primary : colors.muted} />
                <Text
                  className="text-sm flex-1"
                  style={{ color: selected ? colors.primary : colors.ink, fontWeight: selected ? "700" : "500" }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {selected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>

        <Text className="text-muted text-xs font-semibold mb-1.5">Description (optional)</Text>
        <FieldInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe this court..."
          multiline
          numberOfLines={3}
          maxLength={500}
          style={{ height: 80, textAlignVertical: "top" }}
          containerStyle={{ marginBottom: 16 }}
        />

        <Text className="text-muted text-xs font-semibold mb-1.5">Location (optional)</Text>
        <View style={{ marginBottom: 16 }}>
          <LocationPickerField value={location} onChange={setLocation} placeholder="e.g. Ground Floor, Block C" />
        </View>

        <View className="flex-row items-center justify-between border border-border rounded-xl px-4 py-3">
          <View className="flex-1 mr-3">
            <Text className="text-ink font-medium">Active</Text>
            <Text className="text-muted text-xs mt-0.5">Turn off to hide this court from bookings.</Text>
          </View>
          <Switch value={isactive} onValueChange={setIsactive} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>

        {isEditing && params.courtId && (
          <>
            <View className="h-px bg-border my-5" />
            <PriceRulesSection courtId={params.courtId} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
