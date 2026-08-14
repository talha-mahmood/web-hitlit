import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCreateSquad } from "../../hooks/useSquads";
import { useAuthStore } from "../../store/authStore";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import LocationPickerField from "../../components/LocationPickerField";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import SportsBackgroundDecor from "../../components/SportsBackgroundDecor";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "CreateSquad">;
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

export default function CreateSquadScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createSquad = useCreateSquad();

  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!userId) return;
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
      const squad = await createSquad.mutateAsync({
        ownerId: userId,
        name: name.trim(),
        skillLevel,
        location: location.trim(),
        description: description.trim(),
      });
      navigation.replace("SquadDetail", { squadId: squad.id });
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not create squad. Please try again."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SportsBackgroundDecor />

      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <Text className="text-base font-bold text-ink flex-1">Create Squad</Text>
        <Bouncy
          onPress={handleCreate}
          disabled={createSquad.isPending}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            ...primaryButtonShadow,
          }}
        >
          {createSquad.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Post</Text>
          )}
        </Bouncy>
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
