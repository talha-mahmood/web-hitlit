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
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useCreateGame } from "../../hooks/useGames";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import { TIME_SLOTS, DAYS, DURATIONS, MAX_PLAYERS_OPTIONS, addMinutes } from "../../lib/gameFormHelpers";

type Nav = NativeStackNavigationProp<GamesStackParamList, "CreateGame">;
type SkillLevel = Database["public"]["Enums"]["game_skill_level_type"];
type Visibility = Database["public"]["Enums"]["game_visibility_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];
type GameType = Database["public"]["Enums"]["game_type_type"];

// ── main component ────────────────────────────────────────────────────────────

export default function CreateGameScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createGame = useCreateGame();
  const { data: sports } = useSports();

  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState<GameType>("REGULAR");
  const [sportId, setSportId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: sportId ?? undefined });
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [gender, setGender] = useState<Gender>("mixed");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("0");

  const handleSportChange = (id: string) => {
    setSportId(id);
    setVenueId(null); // venue list depends on sport, so a prior pick may no longer apply
  };

  const handleCreate = async () => {
    if (!userId) return;
    if (!title.trim()) {
      Alert.alert("Missing Info", "Please enter a game title.");
      return;
    }
    if (!sportId) {
      Alert.alert("Missing Info", "Please select a sport.");
      return;
    }
    if (!startTime) {
      Alert.alert("Missing Info", "Please select a start time.");
      return;
    }

    const endTimeValue = addMinutes(startTime, Math.round(duration * 60));
    const fee = parseInt(entryFee, 10) || 0;

    try {
      const game = await createGame.mutateAsync({
        creatorId: userId,
        title: title.trim(),
        sportId,
        venueId,
        gameDate: selectedDate,
        startTime: `${startTime}:00`,
        endTime: `${endTimeValue}:00`,
        maxPlayers,
        skillLevel,
        visibility,
        gender,
        description: description.trim(),
        entryFee: fee,
        gameType,
      });
      navigation.replace("GameDetail", { gameId: game.id });
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not create game. Please try again."
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
        <Text className="text-base font-bold text-ink flex-1">Create Game</Text>
        <Pressable
          onPress={handleCreate}
          disabled={createGame.isPending}
          className="bg-primary rounded-xl px-4 py-2"
        >
          {createGame.isPending ? (
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
        {/* Title */}
        <SectionLabel title="Game Title" required />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Saturday morning football"
          className="border border-border rounded-xl px-4 py-3 text-ink"
          maxLength={80}
        />

        {/* Sport */}
        <SectionLabel title="Sport" required />
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {(sports ?? []).map((s) => {
            const selected = sportId === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => handleSportChange(s.id)}
                className={`px-4 py-2 rounded-full border ${selected ? "bg-primary border-primary" : "bg-white border-border"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Game Type */}
        <SectionLabel title="Game Type" />
        <PillRow<GameType>
          options={[
            { label: "Regular", value: "REGULAR" },
            { label: "Tournament", value: "TOURNAMENT" },
          ]}
          value={gameType}
          onChange={setGameType}
        />

        {/* Venue */}
        <SectionLabel title="Venue" />
        {!sportId ? (
          <Text className="text-muted text-sm">Select a sport to see venues that offer it.</Text>
        ) : venuesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !venues || venues.length === 0 ? (
          <Text className="text-muted text-sm">No venues found for this sport yet.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <Pressable
              onPress={() => setVenueId(null)}
              className={`px-4 py-3 rounded-xl border justify-center ${!venueId ? "bg-primary border-primary" : "bg-white border-border"}`}
              style={{ width: 130 }}
            >
              <Text className={`text-sm font-semibold ${!venueId ? "text-white" : "text-ink"}`}>
                No specific venue
              </Text>
              <Text className={`text-xs mt-0.5 ${!venueId ? "text-white" : "text-muted"}`}>
                Decide later
              </Text>
            </Pressable>
            {venues.map((v) => {
              const selected = venueId === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVenueId(v.id)}
                  className={`px-4 py-3 rounded-xl border justify-center ${selected ? "bg-primary border-primary" : "bg-white border-border"}`}
                  style={{ width: 150 }}
                >
                  <Text
                    className={`text-sm font-semibold ${selected ? "text-white" : "text-ink"}`}
                    numberOfLines={1}
                  >
                    {v.name}
                  </Text>
                  <Text
                    className={`text-xs mt-0.5 ${selected ? "text-white" : "text-muted"}`}
                    numberOfLines={1}
                  >
                    {v.city ?? "—"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Date */}
        <SectionLabel title="Date" required />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {DAYS.map((d) => {
            const selected = selectedDate === d.iso;
            return (
              <Pressable
                key={d.iso}
                onPress={() => setSelectedDate(d.iso)}
                className={`items-center px-3 py-2 rounded-xl border ${selected ? "bg-primary border-primary" : "bg-white border-border"}`}
              >
                <Text className={`text-xs ${selected ? "text-white" : "text-muted"}`}>{d.day}</Text>
                <Text className={`text-base font-bold mt-0.5 ${selected ? "text-white" : "text-ink"}`}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Start Time */}
        <SectionLabel title="Start Time" required />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {TIME_SLOTS.map((t) => {
            const selected = startTime === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setStartTime(t.value)}
                className={`px-3 py-2 rounded-xl border ${selected ? "bg-primary border-primary" : "bg-white border-border"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Duration */}
        <SectionLabel title="Duration" />
        <PillRow
          options={DURATIONS.map((d) => ({
            label: d === 1 ? "1 hr" : `${d} hrs`,
            value: String(d) as string,
          }))}
          value={String(duration)}
          onChange={(v) => setDuration(parseFloat(v))}
        />

        {/* Max Players */}
        <SectionLabel title="Max Players" />
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {MAX_PLAYERS_OPTIONS.map((n) => {
            const selected = maxPlayers === n;
            return (
              <Pressable
                key={n}
                onPress={() => setMaxPlayers(n)}
                className={`w-12 py-2 rounded-xl border items-center ${selected ? "bg-primary border-primary" : "bg-white border-border"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Skill Level */}
        <SectionLabel title="Skill Level" />
        <PillRow<SkillLevel | "ANY">
          options={[
            { label: "Any", value: "ANY" as SkillLevel | "ANY" },
            { label: "Beginner", value: "BEGINNER" },
            { label: "Intermediate", value: "INTERMEDIATE" },
            { label: "Advanced", value: "ADVANCED" },
            { label: "Pro", value: "PRO" },
          ]}
          value={skillLevel ?? "ANY"}
          onChange={(v) => setSkillLevel(v === "ANY" ? null : (v as SkillLevel))}
        />

        {/* Gender */}
        <SectionLabel title="Open To" />
        <PillRow<Gender>
          options={[
            { label: "Everyone", value: "mixed" },
            { label: "Male Only", value: "male" },
            { label: "Female Only", value: "female" },
          ]}
          value={gender}
          onChange={setGender}
        />

        {/* Visibility */}
        <SectionLabel title="Visibility" />
        <PillRow<Visibility>
          options={[
            { label: "Public", value: "public" },
            { label: "Private", value: "private" },
          ]}
          value={visibility}
          onChange={setVisibility}
        />

        {/* Entry Fee */}
        <SectionLabel title="Entry Fee (Rs)" />
        <View className="flex-row items-center border border-border rounded-xl px-4">
          <Text className="text-muted mr-2">Rs</Text>
          <TextInput
            value={entryFee}
            onChangeText={(t) => setEntryFee(t.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="0"
            className="flex-1 py-3 text-ink"
          />
        </View>
        <Text className="text-muted text-xs mt-1">Enter 0 for a free game</Text>

        {/* Description */}
        <SectionLabel title="Description" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Optional notes for players (meeting point, equipment, etc.)"
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
