import { useState } from "react";
import {
  View,
  Text,
  Image,
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
import { useProfileStore } from "../../store/profileStore";
import { colors, primaryButtonShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import type { SquadDetail } from "../../lib/api/squads";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import LocationPickerField from "../../components/LocationPickerField";
import FieldInput from "../../components/FieldInput";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type EditRoute = RouteProp<SquadsStackParamList, "EditSquad">;
type Nav = NativeStackNavigationProp<SquadsStackParamList, "EditSquad">;
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];

// ── form (only mounted once the squad has loaded, so state can init from it) ──

function EditSquadForm({ squad }: { squad: SquadDetail }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const updateSquad = useUpdateSquad();
  const myGender = useProfileStore((s) => s.profile?.gender);

  const [name, setName] = useState(squad.name);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(squad.skill_level);
  const [location, setLocation] = useState(squad.location ?? "");
  const [description, setDescription] = useState(squad.description ?? "");
  const [gender, setGender] = useState<Gender>(squad.gender);
  const [iconUrl, setIconUrl] = useState<string | null>(squad.icon_url);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Same reasoning as CreateSquadScreen: the owner is always a member of
  // their own squad, and a Male/Female Only squad only accepts matching
  // members (squad_members RLS) — so only offer a restriction the owner
  // themselves satisfies. The squad's current setting stays selectable even
  // if it wouldn't otherwise be offered, so existing data never disappears
  // from the picker.
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [{ label: "Everyone", value: "mixed" }, { label: "Male Only", value: "male" }]
      : myGender === "female"
        ? [{ label: "Everyone", value: "mixed" }, { label: "Female Only", value: "female" }]
        : [{ label: "Everyone", value: "mixed" }];
  if (!genderOptions.some((o) => o.value === squad.gender)) {
    genderOptions.push({ label: squad.gender === "male" ? "Male Only" : "Female Only", value: squad.gender });
  }

  const handlePickIcon = async () => {
    const assets = await pickImages({});
    if (assets.length === 0) return;
    setUploadingIcon(true);
    try {
      const { publicUrl } = await uploadImage(assets[0], { bucket: "squad-icons", pathPrefix: squad.id });
      setIconUrl(publicUrl);
    } catch (err) {
      Alert.alert("Upload failed", getFriendlyErrorMessage(err, "Could not upload icon."));
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleSave = async () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Group name must be ${NAME_REQUIREMENT_HINT}.`);
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
        iconUrl,
        name: name.trim(),
        skillLevel,
        location: location.trim(),
        description: description.trim(),
        gender,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save changes. Please try again."));
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-app" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink flex-1">Edit Group</Text>
        <Pressable onPress={handleSave} disabled={updateSquad.isPending} style={primaryButtonShadow}>
          <GradientFill className="rounded-xl px-4 py-2">
            {updateSquad.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-jazba-white font-semibold text-sm">Save</Text>
            )}
          </GradientFill>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Custom listing icon (optional) */}
        <SectionLabel title="Icon" />
        <Pressable
          onPress={handlePickIcon}
          disabled={uploadingIcon}
          className="flex-row items-center mb-2"
          style={{ gap: 12 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center overflow-hidden">
            {uploadingIcon ? (
              <ActivityIndicator color={colors.primary} />
            ) : iconUrl ? (
              <Image source={{ uri: iconUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.muted} />
            )}
          </View>
          <Text className="text-primary font-semibold text-sm">
            {iconUrl ? "Change icon" : "Add a custom icon (optional)"}
          </Text>
        </Pressable>

        {/* Name */}
        <SectionLabel title="Group Name" required />
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
          placeholder="Notes about your group (how often you play, vibe, etc.)"
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
      <View className="flex-1 bg-app items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !squad) {
    return (
      <View className="flex-1 bg-app items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Group not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isHost = squad.squad_members.some(
    (m) => m.user_id === userId && m.status === "ACTIVE" && m.role === "host"
  );

  if (squad.squad_owner_id !== userId && !isHost) {
    return (
      <View className="flex-1 bg-app">
        <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
          <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-base font-bold text-ink">Edit Group</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2 text-center">
            Only the captain or a host can edit this group
          </Text>
          <Text className="text-muted text-sm text-center">It can't be edited by other members.</Text>
        </View>
      </View>
    );
  }

  return <EditSquadForm squad={squad} />;
}
