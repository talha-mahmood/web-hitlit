import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
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
import { colors } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import LocationPickerField from "../../components/LocationPickerField";

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
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter a squad name.");
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
    if (!description.trim()) {
      Alert.alert("Missing Info", "Please enter a description.");
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Create Squad</Text>
        <Pressable
          onPress={handleCreate}
          disabled={createSquad.isPending}
          className="bg-primary rounded-xl px-4 py-2"
        >
          {createSquad.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold text-sm">Post</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <SectionLabel title="Squad Name" required />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend Warriors"
          className="border border-border rounded-xl px-4 py-3 text-ink"
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
        <SectionLabel title="Description" required />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes about your squad (how often you play, vibe, etc.)"
          className="border border-border rounded-xl px-4 py-3 text-ink"
          multiline
          numberOfLines={3}
          maxLength={300}
          style={{ height: 88, textAlignVertical: "top" }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
