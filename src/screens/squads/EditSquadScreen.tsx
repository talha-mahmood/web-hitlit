import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSquadDetail, useUpdateSquad } from "../../hooks/useSquads";
import { useAuthStore } from "../../store/authStore";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import type { SquadDetail } from "../../lib/api/squads";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import LocationPickerField from "../../components/LocationPickerField";
import FieldInput from "../../components/FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";

type EditRoute = RouteProp<SquadsStackParamList, "EditSquad">;
type Nav = NativeStackNavigationProp<SquadsStackParamList, "EditSquad">;
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

// ── form (only mounted once the squad has loaded, so state can init from it) ──

function EditSquadForm({ squad }: { squad: SquadDetail }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const updateSquad = useUpdateSquad();

  const [name, setName] = useState(squad.name);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(squad.skill_level);
  const [location, setLocation] = useState(squad.location ?? "");
  const [description, setDescription] = useState(squad.description ?? "");

  const handleSave = async () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Squad name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (!skillLevel) {
      Alert.alert("Missing Info", "Please select a skill level.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Missing Info", "Please enter a location.");
      return;
    }
    try {
      await updateSquad.mutateAsync({
        squadId: squad.id,
        name: name.trim(),
        skillLevel,
        location: location.trim(),
        description: description.trim(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not save changes. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Edit Squad</Text>
        <Pressable
          onPress={handleSave}
          disabled={updateSquad.isPending}
          className="bg-primary rounded-xl px-4 py-2"
          style={primaryButtonShadow}
        >
          {updateSquad.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <SectionLabel title="Squad Name" required />
        <FieldInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend Warriors"
          maxLength={80}
        />

        {/* Skill Level */}
        <SectionLabel title="Skill Level" required />
        <PillRow<SkillLevel>
          options={[
            { label: "Beginner", value: "beginner" },
            { label: "Intermediate", value: "intermediate" },
            { label: "Expert", value: "expert" },
          ]}
          value={skillLevel}
          onChange={setSkillLevel}
        />

        {/* Location */}
        <SectionLabel title="Location" required />
        <LocationPickerField value={location} onChange={setLocation} />

        {/* Description */}
        <SectionLabel title="Description" />
        <FieldInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes about your squad (how often you play, vibe, etc.)"
          multiline
          numberOfLines={3}
          maxLength={300}
          style={{ height: 88, textAlignVertical: "top" }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function EditSquadScreen() {
  const { params } = useRoute<EditRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: squad, isLoading, error } = useSquadDetail(params.squadId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !squad) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Squad not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (squad.squad_owner_id !== userId) {
    return (
      <View className="flex-1 bg-gray-100">
        <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
          <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-base font-bold text-ink">Edit Squad</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2 text-center">
            Only the captain can edit this squad
          </Text>
          <Text className="text-muted text-sm text-center">It can't be edited by other members.</Text>
        </View>
      </View>
    );
  }

  return <EditSquadForm squad={squad} />;
}
