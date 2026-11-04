import { useEffect, useState } from "react";
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
  useWindowDimensions,
} from "react-native";
import type * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCreateSquad } from "../../hooks/useSquads";
import { useSports } from "../../hooks/useSports";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import type { Database } from "../../types/database.types";
import LocationMapPicker from "../../components/LocationMapPicker";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import { HomeSportTile } from "../../components/HomeWideCards";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { detectCurrentCoordinates, reverseGeocodeViaNominatim } from "../../lib/locationPicker";
import type { SquadGroupType } from "../../lib/api/squads";
import type { AddTeamParams } from "../../navigation/addTeamTypes";
import GradientFill from "../../components/GradientFill";

// This screen is registered identically in the Squads/Community/Home/Games
// stacks (same pattern as PlayerProfile etc.) — typed against
// SquadsStackParamList like the others, with "AddTeam" intersected in since
// only the Games/Community/Home stacks actually have that route (reached
// only via the returnTo branch below, never from the plain Squads tab).
type Route = RouteProp<SquadsStackParamList, "CreateSquad">;
type Nav = NativeStackNavigationProp<SquadsStackParamList & { AddTeam: AddTeamParams }, "CreateSquad">;

const GROUP_TYPE_LABELS: Record<SquadGroupType, string> = {
  group: "Group",
  club: "Club",
  training_camp: "Training Camp",
  team: "Team",
};
type SkillLevel = Database["public"]["Enums"]["skill_level_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];

// White section card with an icon on the left, a title row (with an optional
// hint on the right) and the control(s) underneath.
function FormCard({
  icon,
  title,
  required,
  optional,
  hint,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className="flex-row bg-white"
      style={{ borderRadius: 16, padding: 13, gap: 11, borderWidth: 1, borderColor: "rgba(17,24,39,0.05)", ...cardShadow }}
    >
      <Ionicons name={icon} size={19} color={colors.primary} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink" style={{ fontSize: 14 }}>
            <Text className="font-bold">{title}</Text>
            {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
            {optional ? <Text className="text-muted" style={{ fontWeight: "400" }}> (Optional)</Text> : null}
          </Text>
          {hint ? (
            <Text className="text-muted" style={{ fontSize: 11.5 }}>
              {hint}
            </Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
            {subtitle}
          </Text>
        ) : null}
        <View style={{ marginTop: 10 }}>{children}</View>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 11,
        paddingVertical: 6.5,
        gap: 6,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? "#DCEFE4" : "white",
      }}
    >
      <Text
        className={selected ? "font-bold" : "font-medium"}
        style={{ fontSize: 12, color: selected ? colors.primaryDark : colors.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export default function CreateSquadScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Same 4-across sport tiles as Create Game, sized to fit inside the Sport card
  // (screen padding + card padding + icon column take ~100 off the width).
  const sportTileGap = 12;
  const sportTileWidth = (windowWidth - 100 - sportTileGap * 3) / 4;
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
  const [groupType, setGroupType] = useState<SquadGroupType>(params?.presetType ?? "group");
  const lockType = !!params?.lockType;
  const [sportId, setSportId] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender>("mixed");
  const selectedSportName = sports?.find((s) => s.id === sportId)?.name ?? null;

  // Location — same interactive map-pin picker as Host Event's own Location
  // field (which itself copies Host Tournament's "Enter Location Manually"
  // flow). No app venue list to fall back to here either, so this is the
  // only mode and starts centered on the host's current location.
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingDevice, setLocatingDevice] = useState(true);
  const [confirmingLocation, setConfirmingLocation] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { latitude, longitude } = await detectCurrentCoordinates();
        setMapCenter({ lat: latitude, lng: longitude });
      } catch {
        // Permission denied or GPS unavailable — a sensible default center
        // (Lahore; this app is Pakistan-only) beats blocking the picker.
        setMapCenter({ lat: 31.5204, lng: 74.3587 });
      } finally {
        setLocatingDevice(false);
      }
    })();
  }, []);

  const handleConfirmMapLocation = async (lat: number, lng: number) => {
    setConfirmingLocation(true);
    try {
      const label = await reverseGeocodeViaNominatim(lat, lng);
      setLocation(label);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not look up an address for this location."));
    } finally {
      setConfirmingLocation(false);
    }
  };

  const handleCreate = async () => {
    if (!userId) return;
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Group name must be ${NAME_REQUIREMENT_HINT}.`);
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
        groupType,
      });
      // The icon bucket's RLS requires the squad to already exist (it checks
      // squad_owner_id via the squad row), so the upload can only happen
      // after creation succeeds — a picked icon sits as a local asset until now.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "squad-icons", pathPrefix: squad.id });
        await supabase.from("squads").update({ icon_url: publicUrl }).eq("id", squad.id);
      }
      if (params?.returnTo) {
        navigation.replace("AddTeam", { ...params.returnTo, squadId: squad.id });
      } else {
        navigation.replace("SquadDetail", { squadId: squad.id });
      }
    } catch (err) {
      Alert.alert(
        "Error",
        getFriendlyErrorMessage(err, "Could not create group. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <View className="flex-1">
          <Text className="text-ink font-extrabold" style={{ fontSize: 19 }}>
            Create Group
          </Text>
          <Text className="text-muted" style={{ fontSize: 13, marginTop: 1 }}>
            Build a team, find players
          </Text>
        </View>
        <Pressable onPress={handleCreate} disabled={createSquad.isPending} style={primaryButtonShadow}>
          <GradientFill
            style={{
              borderRadius: 14,
              paddingHorizontal: 22,
              paddingVertical: 9,
              minWidth: 66,
              alignItems: "center",
            }}
          >
            {createSquad.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-bold" style={{ fontSize: 14.5 }}>
                Post
              </Text>
            )}
          </GradientFill>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 260, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro banner */}
        {/* Same brand gradient as the custom-icon banner on Create Game. */}
        <GradientFill
          style={{
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 11,
            overflow: "hidden",
            ...cardShadow,
          }}
        >
          <View className="flex-row items-center">
            <View className="flex-1" style={{ paddingRight: 8 }}>
              <Text className="text-white font-extrabold" style={{ fontSize: 18 }}>
                Play Together
              </Text>
              <Text className="text-white" style={{ fontSize: 12, lineHeight: 16, marginTop: 3, opacity: 0.8 }}>
                Create a group and bring people together!
              </Text>
            </View>
            <View className="items-center justify-center" style={{ width: 56, height: 48 }}>
              <MaterialCommunityIcons name="account-group" size={46} color="#8FD9AE" />
              {[
                { left: 2, top: 2, rotate: "-40deg" },
                { left: 30, top: -4, rotate: "0deg" },
                { left: 58, top: 2, rotate: "40deg" },
              ].map((p, i) => (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.left,
                    top: p.top,
                    width: 9,
                    height: 2.5,
                    borderRadius: 2,
                    backgroundColor: "#8FD9AE",
                    transform: [{ rotate: p.rotate }],
                  }}
                />
              ))}
            </View>
            <View style={{ width: 64, transform: [{ rotate: "-9deg" }] }}>
              <Text style={{ fontSize: 11, lineHeight: 14, fontStyle: "italic", fontWeight: "700", color: "white" }}>
                {"More\nPlayers\nMore Fun!"}
              </Text>
              <View style={{ width: 48, height: 2, borderRadius: 2, backgroundColor: "#8FD9AE", marginTop: 1 }} />
            </View>
          </View>
        </GradientFill>

        {/* Custom listing icon (optional) */}
        <FormCard
          icon="pricetag"
          title="Group Icon"
          optional
          subtitle="Add a custom icon to make your group stand out"
        >
          <Pressable
            onPress={async () => {
              const assets = await pickImages({});
              if (assets[0]) setIconAsset(assets[0]);
            }}
            className="flex-row items-center"
            style={{ gap: 12 }}
          >
            <View>
              <View
                className="items-center justify-center overflow-hidden"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 13,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: "#8FD9AE",
                  backgroundColor: "#F0FDF4",
                }}
              >
                {iconAsset ? (
                  <Image source={{ uri: iconAsset.uri }} style={{ width: 52, height: 52 }} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={22} color={colors.muted} />
                )}
              </View>
              <GradientFill
                className="items-center justify-center"
                style={{
                  position: "absolute",
                  right: -4,
                  bottom: -4,
                  width: 17,
                  height: 17,
                  borderRadius: 8.5,
                  borderWidth: 2,
                  borderColor: "white",
                }}
              >
                <Ionicons name="add" size={11} color="white" />
              </GradientFill>
            </View>
            <View className="rounded-2xl" style={{ backgroundColor: "#DCEFE4", paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text className="font-bold" style={{ color: colors.primaryDark, fontSize: 13 }}>
                {iconAsset ? "Change icon" : "Add a custom icon"}
              </Text>
            </View>
          </Pressable>
        </FormCard>

        {/* Name */}
        <FormCard icon="people" title="Group Name" required>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View
              className="items-center justify-center"
              style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" }}
            >
              <Ionicons name="people" size={20} color="#4B5563" />
            </View>
            <View className="flex-1">
              <FieldInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Weekend Warriors"
                maxLength={80}
                compact
              />
            </View>
          </View>
        </FormCard>

        {/* Group Type — locked to "Team" (non-editable) when creating a
            tournament team via AddTeamScreen's "Create Team" button. */}
        <FormCard icon="albums" title="Group Type" hint={lockType ? undefined : "What kind of group is this?"}>
          {lockType ? (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <View
                className="rounded-full"
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6.5,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  backgroundColor: "#DCEFE4",
                }}
              >
                <Text className="font-bold" style={{ fontSize: 12, color: colors.primaryDark }}>
                  {GROUP_TYPE_LABELS[groupType]}
                </Text>
              </View>
              <Text className="text-muted" style={{ fontSize: 12 }}>
                Locked
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChipRow<SquadGroupType>
                options={[
                  { label: "Group", value: "group" },
                  { label: "Club", value: "club" },
                  { label: "Training Camp", value: "training_camp" },
                  { label: "Team", value: "team" },
                ]}
                value={groupType}
                onChange={setGroupType}
              />
            </ScrollView>
          )}
        </FormCard>

        {/* Sport */}
        <FormCard icon="trophy" title="Sport" required hint="Select your sport">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: sportTileGap }}
          >
            {(sports ?? []).map((s) => (
              <HomeSportTile
                key={s.id}
                name={s.name}
                width={sportTileWidth}
                selected={sportId === s.id}
                onPress={() => setSportId(s.id)}
              />
            ))}
          </ScrollView>
        </FormCard>

        {/* Skill Level */}
        <FormCard icon="stats-chart" title="Skill Level" required hint="Choose your group's level">
          <ChipRow<SkillLevel>
            options={[
              { label: "Beginner", value: "beginner" },
              { label: "Intermediate", value: "intermediate" },
              { label: "Expert", value: "expert" },
            ]}
            value={skillLevel}
            onChange={setSkillLevel}
          />
        </FormCard>

        {/* Open To */}
        <FormCard icon="people" title="Open To">
          <ChipRow<Gender> options={genderOptions} value={gender} onChange={setGender} />
        </FormCard>

        {/* Location — same interactive map-pin picker as Host Event's own
            Location field (no app venue list here either, so it's always
            on, no toggle). */}
        <FormCard icon="location" title="Location" required>
          {locatingDevice || !mapCenter ? (
            <View className="rounded-2xl items-center justify-center" style={{ height: 260, backgroundColor: colors.primaryLight }}>
              <ActivityIndicator color={colors.primary} />
              <Text className="text-primary text-xs font-semibold mt-2">Finding your location…</Text>
            </View>
          ) : (
            <LocationMapPicker
              initialLat={mapCenter.lat}
              initialLng={mapCenter.lng}
              onConfirm={handleConfirmMapLocation}
              confirming={confirmingLocation}
              selectedLabel={location}
            />
          )}
          {/* The map's own reverse-geocoded label isn't always exact — once a
              spot is picked, let the host type over it with the real address. */}
          {location && (
            <View className="mt-3">
              <Text className="text-ink text-sm font-semibold mb-1.5">
                Address <Text className="text-muted font-normal">(optional — edit if this isn't exact)</Text>
              </Text>
              <FieldInput value={location} onChangeText={setLocation} placeholder="Enter the exact address" multiline compact />
            </View>
          )}
        </FormCard>

        {/* Description */}
        <FormCard icon="document-text" title="Description">
          <FieldInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes about your group (how often you play, vibe, etc.)"
            multiline
            numberOfLines={3}
            maxLength={300}
            style={{ height: 76, textAlignVertical: "top" }}
            compact
          />
        </FormCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
