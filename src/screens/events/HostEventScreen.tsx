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
} from "react-native";
import type * as ImagePicker from "expo-image-picker";
import Animated from "react-native-reanimated";
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
import LocationMapPicker from "../../components/LocationMapPicker";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { detectCurrentCoordinates, reverseGeocodeViaNominatim } from "../../lib/locationPicker";
import { useSelectPulse } from "../../lib/useSelectPulse";
import GradientFill from "../../components/GradientFill";
import {
  DAYS,
  TIME_SLOTS,
  TOURNAMENT_DURATIONS_DAYS,
  addMinutesWithOverflow,
  addDays,
  isTimeSlotPast,
} from "../../lib/gameFormHelpers";

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
      className="flex-row bg-surface"
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

// Date chip — same two-line "weekday / date number" card shape as Host
// Tournament's own Date picker (CreateGameScreen.tsx's DateChipItem), but
// using this screen's own Duration/Start Time/Hours chip's selected
// treatment (flat pale-green fill + dark-green text) instead of that one's
// gradient, so every selected chip on this form matches.
function dateChipStyle(selected: boolean) {
  return {
    borderWidth: 1.5,
    borderRadius: 16,
    borderColor: selected ? colors.primary : colors.border,
  };
}

function DateChipFill({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  return (
    <View
      className="items-center px-3 py-2.5 rounded-2xl"
      style={{ backgroundColor: selected ? colors.primaryLight : colors.surface }}
    >
      {children}
    </View>
  );
}

function DateChipItem({
  day,
  label,
  selected,
  onPress,
}: {
  day: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const pulseStyle = useSelectPulse(selected);
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={onPress} style={dateChipStyle(selected)}>
        <DateChipFill selected={selected}>
          <Text className="text-xs" style={{ color: selected ? colors.primaryDark : colors.muted }}>
            {day}
          </Text>
          <Text
            className="text-base font-bold mt-0.5"
            style={{ color: selected ? colors.primaryDark : colors.ink }}
          >
            {label}
          </Text>
        </DateChipFill>
      </Pressable>
    </Animated.View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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
        backgroundColor: selected ? colors.primaryLight : colors.surface,
      }}
    >
      <Text className={selected ? "font-bold" : "font-medium"} style={{ fontSize: 12, color: selected ? colors.primaryDark : colors.ink }}>
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

  // Date/Duration/Start Time/Hours — same fields, options and end-date/time
  // derivation as Host Tournament's single-day/multi-day logic
  // (CreateGameScreen.tsx), since an event is a multi-day thing the same way
  // a tournament is (no fixed hour-long "regular game" slot).
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [hoursPerDay, setHoursPerDay] = useState<number>(1);
  const HOURS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

  // Location — same interactive map-pin picker as Host Tournament's "Enter
  // Location Manually" flow (CreateGameScreen.tsx). Events have no app venue
  // list to fall back to, so this is the only mode and starts centered on
  // the host's current location automatically, instead of behind a toggle.
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
    if (!startTime) {
      Alert.alert("Missing Info", "Please select a start time.");
      return;
    }
    if (selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, startTime)) {
      Alert.alert("Invalid Start Time", "That time has already passed. Please pick a later start time.");
      return;
    }

    // A single-day event works the same way a single-day tournament does:
    // start time + hours per day fully determines its one day's end time.
    // A multi-day event's last day instead closes at 23:59:59, since there's
    // no single predetermined end hour across multiple days.
    const singleDayEnd = durationDays === 1 ? addMinutesWithOverflow(startTime, hoursPerDay * 60) : null;
    const endDateValue =
      durationDays === 1
        ? singleDayEnd!.daysOverflow > 0
          ? addDays(selectedDate, singleDayEnd!.daysOverflow)
          : null
        : addDays(selectedDate, durationDays - 1);
    const endTimeValue = durationDays === 1 ? `${singleDayEnd!.time}:00` : "23:59:59";

    try {
      const event = await createEvent.mutateAsync({
        ownerId: userId,
        name: name.trim(),
        eventType: eventType.trim(),
        location: location.trim(),
        description: description.trim(),
        gender,
        eventDate: selectedDate,
        startTime: `${startTime}:00`,
        endDate: endDateValue,
        endTime: endTimeValue,
        dailyHours: hoursPerDay,
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
    <KeyboardAvoidingView className="flex-1 bg-app" behavior={Platform.OS === "ios" ? "padding" : "height"}>
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
              <Text className="text-jazba-white font-bold" style={{ fontSize: 14.5 }}>
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
        <GradientFill style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, overflow: "hidden", ...cardShadow }}>
          <View className="flex-row items-center">
            <View className="flex-1" style={{ paddingRight: 8 }}>
              <Text className="text-jazba-white font-extrabold" style={{ fontSize: 18 }}>
                Host an Event
              </Text>
              <Text className="text-jazba-white" style={{ fontSize: 12, lineHeight: 16, marginTop: 3, opacity: 0.8 }}>
                Create an event and bring people together!
              </Text>
            </View>
            <View className="items-center justify-center" style={{ width: 56, height: 48 }}>
              <MaterialCommunityIcons name="calendar-star" size={44} color="#8FD9AE" />
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
                  width: 52,
                  height: 52,
                  borderRadius: 13,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: "#8FD9AE",
                  backgroundColor: colors.primaryLight,
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
                style={{ position: "absolute", right: -4, bottom: -4, width: 17, height: 17, borderRadius: 8.5, borderWidth: 2, borderColor: "white" }}
              >
                <Ionicons name="add" size={11} color="white" />
              </GradientFill>
            </View>
            <View className="rounded-2xl" style={{ backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text className="font-bold" style={{ color: colors.primaryDark, fontSize: 13 }}>
                {iconAsset ? "Change icon" : "Add a custom icon"}
              </Text>
            </View>
          </Pressable>
        </FormCard>

        {/* Name */}
        <FormCard icon="calendar" title="Event Name" required>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surfaceOverlay }}>
              <Ionicons name="calendar" size={20} color="#4B5563" />
            </View>
            <View className="flex-1">
              <FieldInput value={name} onChangeText={setName} placeholder="e.g. Sunday Sports Fest" maxLength={80} compact />
            </View>
          </View>
        </FormCard>

        {/* Event Type — free text, replaces Squad's Sport picker. */}
        <FormCard icon="albums" title="Event Type" required hint="What kind of event is this?">
          <FieldInput value={eventType} onChangeText={setEventType} placeholder="e.g. Cricket Tournament, Fitness Camp" maxLength={60} compact />
        </FormCard>

        {/* Date / Duration / Start Time / Hours — same fields, options and
            scrolling-chip behavior as Host Tournament's scheduling section
            (CreateGameScreen.tsx), since an event can span multiple days the
            same way a tournament can. */}
        <FormCard icon="calendar-outline" title="Date & Time" required>
          <View className="flex-row items-center" style={{ gap: 6, marginBottom: 10 }}>
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <Text className="text-ink font-extrabold" style={{ fontSize: 13 }}>
              Date
            </Text>
            <Text style={{ color: colors.danger }}>*</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {DAYS.filter((d) => TIME_SLOTS.some((t) => !isTimeSlotPast(d.iso, t.value))).map((d) => (
              <DateChipItem
                key={d.iso}
                day={d.day}
                label={d.label}
                selected={selectedDate === d.iso}
                onPress={() => {
                  setSelectedDate(d.iso);
                  // A time picked for a later date can be in the past once
                  // the user switches to today — clear it rather than leave
                  // an invalid selection sitting there.
                  if (startTime && d.iso === DAYS[0].iso && isTimeSlotPast(d.iso, startTime)) {
                    setStartTime(null);
                  }
                }}
              />
            ))}
          </ScrollView>

          <Text className="text-ink font-semibold" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>
            Duration
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TOURNAMENT_DURATIONS_DAYS.map((d) => (
              <Chip key={d} label={`${d} day${d > 1 ? "s" : ""}`} selected={durationDays === d} onPress={() => setDurationDays(d)} />
            ))}
          </ScrollView>

          <Text className="text-ink font-semibold" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>
            Start Time (Each Day)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIME_SLOTS.filter(
              (t) => !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value))
            ).map((t) => (
              <Chip key={t.value} label={t.label} selected={startTime === t.value} onPress={() => setStartTime(t.value)} />
            ))}
          </ScrollView>

          <Text className="text-ink font-semibold" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>
            Hours (Each Day)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {HOURS_PER_DAY_OPTIONS.map((h) => (
              <Chip key={h} label={h === 1 ? "1 hr" : `${h} hrs`} selected={hoursPerDay === h} onPress={() => setHoursPerDay(h)} />
            ))}
          </ScrollView>
        </FormCard>

        {/* Open To */}
        <FormCard icon="people" title="Open To">
          <ChipRow<Gender> options={genderOptions} value={gender} onChange={setGender} />
        </FormCard>

        {/* Location — same interactive map-pin picker as Host Tournament's
            "Enter Location Manually" flow. Events have no app venue list, so
            this is the only mode (no toggle). */}
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
            placeholder="Notes about your event (schedule, vibe, etc.)"
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
