import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCreateSquad } from "../../hooks/useSquads";
import { useSports } from "../../hooks/useSports";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import LocationPickerField from "../../components/LocationPickerField";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import SportsBackgroundDecor from "../../components/SportsBackgroundDecor";
import SportHeroBadge from "../../components/SportHeroBadge";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SquadsStackParamList, "CreateSquad">;
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];

export default function CreateSquadScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createSquad = useCreateSquad();
  const { data: sports } = useSports();

  // The squad owner auto-joins their own squad as captain, and a Male/Female
  // Only squad only accepts members matching that gender (see the
  // squad_members RLS policy) — so a restricted option that would exclude
  // the creator themselves is never offered.
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [{ label: "Everyone", value: "mixed" }, { label: "Male Only", value: "male" }]
      : myGender === "female"
        ? [{ label: "Everyone", value: "mixed" }, { label: "Female Only", value: "female" }]
        : [{ label: "Everyone", value: "mixed" }];

  const [name, setName] = useState("");
  const [iconAsset, setIconAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sportId, setSportId] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender>("mixed");
  const selectedSportName = sports?.find((s) => s.id === sportId)?.name ?? null;

  const handleCreate = async () => {
    if (!userId) return;
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Squad name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (!sportId) {
      Alert.alert("Missing Info", "Please select a sport.");
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
        sportId,
        skillLevel,
        location: location.trim(),
        description: description.trim(),
        gender,
      });
      // The icon bucket's RLS requires the squad to already exist (it checks
      // squad_owner_id via the squad row), so the upload can only happen
      // after creation succeeds — a picked icon sits as a local asset until now.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "squad-icons", pathPrefix: squad.id });
        await supabase.from("squads").update({ icon_url: publicUrl }).eq("id", squad.id);
      }
      navigation.replace("SquadDetail", { squadId: squad.id });
    } catch (err) {
      Alert.alert(
        "Error",
        getFriendlyErrorMessage(err, "Could not create squad. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-green-50"
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
        <Pressable
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
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Custom listing icon (optional) */}
        <SectionLabel title="Icon" />
        <Pressable
          onPress={async () => {
            const assets = await pickImages({});
            if (assets[0]) setIconAsset(assets[0]);
          }}
          className="flex-row items-center mb-2"
          style={{ gap: 12 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center overflow-hidden">
            {iconAsset ? (
              <Image source={{ uri: iconAsset.uri }} style={{ width: 56, height: 56 }} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.muted} />
            )}
          </View>
          <Text className="text-primary font-semibold text-sm">
            {iconAsset ? "Change icon" : "Add a custom icon (optional)"}
          </Text>
        </Pressable>

        {/* Name */}
        <SectionLabel title="Squad Name" required />
        <FieldInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend Warriors"
          maxLength={80}
        />

        {/* Sport */}
        <SectionLabel title="Sport" required />
        {selectedSportName && (
          <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
            <SportHeroBadge sportName={selectedSportName} />
            <Text className="text-ink font-semibold flex-1">{selectedSportName}</Text>
          </View>
        )}
        <PillRow
          options={(sports ?? []).map((s) => ({ label: s.name, value: s.id }))}
          value={sportId}
          onChange={setSportId}
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

        {/* Open To */}
        <SectionLabel title="Open To" icon="people-outline" />
        <PillRow<Gender> options={genderOptions} value={gender} onChange={setGender} />

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
