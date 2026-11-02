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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCreateEvent } from "../../hooks/useEvents";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import type { Database } from "../../types/database.types";
import LocationPickerField from "../../components/LocationPickerField";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GradientFill from "../../components/GradientFill";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "HostEvent">;
type Gender = Database["public"]["Enums"]["game_gender_type"];

// Same FormCard/Chip/ChipRow DNA as CreateSquadScreen — white section card
// with an icon on the left, a title row (with an optional hint on the
// right) and the control(s) underneath.
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
      style={{ borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: "rgba(17,24,39,0.05)", ...cardShadow }}
    >
      <Ionicons name={icon} size={22} color={colors.primary} style={{ marginTop: 1 }} />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-ink" style={{ fontSize: 15.5 }}>
            <Text className="font-bold">{title}</Text>
            {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
            {optional ? <Text className="text-muted" style={{ fontWeight: "400" }}> (Optional)</Text> : null}
          </Text>
          {hint ? (
            <Text className="text-muted" style={{ fontSize: 12.5 }}>
              {hint}
            </Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text className="text-muted" style={{ fontSize: 13, marginTop: 3 }}>
            {subtitle}
          </Text>
        ) : null}
        <View style={{ marginTop: 12 }}>{children}</View>
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        gap: 7,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? "#DCEFE4" : "white",
      }}
    >
      <Text className={selected ? "font-bold" : "font-medium"} style={{ fontSize: 13.5, color: selected ? colors.primaryDark : colors.ink }}>
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

export default function HostEventScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createEvent = useCreateEvent();

  // The event owner auto-joins their own event as captain, and a
  // Male/Female Only event only accepts members matching that gender (see
  // the event_members RLS policy) — so a restricted option that would
  // exclude the creator themselves is never offered.
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [{ label: "Everyone", value: "mixed" }, { label: "Male Only", value: "male" }]
      : myGender === "female"
        ? [{ label: "Everyone", value: "mixed" }, { label: "Female Only", value: "female" }]
        : [{ label: "Everyone", value: "mixed" }];

  const [name, setName] = useState("");
  const [iconAsset, setIconAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [eventType, setEventType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [gender, setGender] = useState<Gender>("mixed");

  const handleCreate = async () => {
    if (!userId) return;
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `Event name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    if (!eventType.trim()) {
      Alert.alert("Missing Info", "Please enter the event type.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Missing Info", "Please enter a location.");
      return;
    }
    try {
      const event = await createEvent.mutateAsync({
        ownerId: userId,
        name: name.trim(),
        eventType: eventType.trim(),
        location: location.trim(),
        description: description.trim(),
        gender,
      });
      // The icon bucket's RLS requires the event to already exist (it checks
      // event_owner_id via the event row), so the upload can only happen
      // after creation succeeds — a picked icon sits as a local asset until now.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "event-icons", pathPrefix: event.id });
        await supabase.from("events").update({ icon_url: publicUrl }).eq("id", event.id);
      }
      navigation.replace("EventDetail", { eventId: event.id });
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create event. Please try again."));
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Header */}
      <View className="flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <View className="flex-1">
          <Text className="text-ink font-extrabold" style={{ fontSize: 19 }}>
            Host Event
          </Text>
          <Text className="text-muted" style={{ fontSize: 13, marginTop: 1 }}>
            Organize a sports event
          </Text>
        </View>
        <Pressable onPress={handleCreate} disabled={createEvent.isPending} style={primaryButtonShadow}>
          <GradientFill
            style={{ borderRadius: 14, paddingHorizontal: 22, paddingVertical: 9, minWidth: 66, alignItems: "center" }}
          >
            {createEvent.isPending ? (
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
        <GradientFill style={{ borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16, overflow: "hidden", ...cardShadow }}>
          <View className="flex-row items-center">
            <View className="flex-1" style={{ paddingRight: 8 }}>
              <Text className="text-white font-extrabold" style={{ fontSize: 22 }}>
                Host an Event
              </Text>
              <Text className="text-white" style={{ fontSize: 13.5, lineHeight: 19, marginTop: 4, opacity: 0.8 }}>
                Create an event and bring people together!
              </Text>
            </View>
            <View className="items-center justify-center" style={{ width: 70, height: 60 }}>
              <MaterialCommunityIcons name="calendar-star" size={56} color="#8FD9AE" />
            </View>
          </View>
        </GradientFill>

        {/* Custom listing icon (optional) */}
        <FormCard icon="pricetag" title="Event Icon" optional subtitle="Add a custom icon to make your event stand out">
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
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: "#8FD9AE",
                  backgroundColor: "#F0FDF4",
                }}
              >
                {iconAsset ? (
                  <Image source={{ uri: iconAsset.uri }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={26} color={colors.muted} />
                )}
              </View>
              <GradientFill
                className="items-center justify-center"
                style={{ position: "absolute", right: -5, bottom: -5, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "white" }}
              >
                <Ionicons name="add" size={13} color="white" />
              </GradientFill>
            </View>
            <View className="rounded-2xl" style={{ backgroundColor: "#DCEFE4", paddingHorizontal: 22, paddingVertical: 14 }}>
              <Text className="font-bold" style={{ color: colors.primaryDark, fontSize: 14.5 }}>
                {iconAsset ? "Change icon" : "Add a custom icon"}
              </Text>
            </View>
          </Pressable>
        </FormCard>

        {/* Name */}
        <FormCard icon="calendar" title="Event Name" required>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" }}>
              <Ionicons name="calendar" size={20} color="#4B5563" />
            </View>
            <View className="flex-1">
              <FieldInput value={name} onChangeText={setName} placeholder="e.g. Sunday Sports Fest" maxLength={80} />
            </View>
          </View>
        </FormCard>

        {/* Event Type — free text, replaces Squad's Sport picker. */}
        <FormCard icon="albums" title="Event Type" required hint="What kind of event is this?">
          <FieldInput value={eventType} onChangeText={setEventType} placeholder="e.g. Cricket Tournament, Fitness Camp" maxLength={60} />
        </FormCard>

        {/* Open To */}
        <FormCard icon="people" title="Open To">
          <ChipRow<Gender> options={genderOptions} value={gender} onChange={setGender} />
        </FormCard>

        {/* Location */}
        <FormCard icon="location" title="Location" required>
          <LocationPickerField value={location} onChange={setLocation} variant="card" />
        </FormCard>

        {/* Description */}
        <FormCard icon="document-text" title="Description">
          <FieldInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes about your event (schedule, vibe, etc.)"
            multiline
            numberOfLines={3}
            maxLength={300}
            style={{ height: 88, textAlignVertical: "top" }}
          />
        </FormCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
