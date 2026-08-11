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
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
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
import VenueSearchField from "../../components/VenueSearchField";
import {
  TIME_SLOTS,
  DAYS,
  DURATIONS,
  TOURNAMENT_DURATIONS_DAYS,
  MAX_PLAYERS_OPTIONS,
  addMinutes,
  addDays,
  isTimeSlotPast,
} from "../../lib/gameFormHelpers";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";

type Nav = NativeStackNavigationProp<GamesStackParamList, "CreateGame">;
type CreateGameRoute = RouteProp<GamesStackParamList, "CreateGame">;
type SkillLevel = Database["public"]["Enums"]["game_skill_level_type"];
type Visibility = Database["public"]["Enums"]["game_visibility_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];
type GameType = Database["public"]["Enums"]["game_type_type"];

// ── main component ────────────────────────────────────────────────────────────

export default function CreateGameScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CreateGameRoute>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createGame = useCreateGame();
  const { data: sports } = useSports();

  // Reached via the Tournaments section (Home card / Tournaments list "Create"
  // button) — game type is fixed, not a Regular/Tournament toggle.
  const forcedTournament = route.params?.gameType === "TOURNAMENT";

  const [title, setTitle] = useState("");
  const [gameType, setGameType] = useState<GameType>(forcedTournament ? "TOURNAMENT" : "REGULAR");
  const [sportId, setSportId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: sportId ?? undefined });
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [numberOfTeams, setNumberOfTeams] = useState("");
  const [playersPerTeam, setPlayersPerTeam] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [gender, setGender] = useState<Gender>("mixed");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("0");

  const handleSportChange = (id: string) => {
    setSportId(id);
    setVenueId(null); // venue list depends on sport, so a prior pick may no longer apply
  };

  const isTournament = gameType === "TOURNAMENT";

  const handleCreate = async () => {
    if (!userId) return;
    if (!isValidName(title)) {
      Alert.alert(
        "Invalid Title",
        `${isTournament ? "Tournament" : "Game"} title must be ${NAME_REQUIREMENT_HINT}.`
      );
      return;
    }
    if (!sportId) {
      Alert.alert("Missing Info", "Please select a sport.");
      return;
    }
    if (!venueId) {
      Alert.alert("Missing Info", "Please select a venue.");
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
    if (!skillLevel) {
      Alert.alert("Missing Info", "Please select a skill level.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing Info", "Please enter a description.");
      return;
    }

    const teams = parseInt(numberOfTeams, 10) || 0;
    const perTeam = parseInt(playersPerTeam, 10) || 0;
    if (isTournament && (teams < 2 || perTeam < 1)) {
      Alert.alert("Missing Info", "Please enter a number of teams (2+) and players per team.");
      return;
    }

    // Regular games run start_time..end_time on a single game_date. A
    // tournament instead spans durationDays calendar days starting at
    // game_date; its last day (end_date) formally closes at 23:59:59 rather
    // than some fixed hour, since matches on the final day don't have a
    // predetermined end time the way a single game session does.
    const endDateValue = isTournament ? addDays(selectedDate, durationDays - 1) : null;
    const endTimeValue = isTournament ? "23:59:59" : `${addMinutes(startTime, Math.round(duration * 60))}:00`;
    const fee = parseInt(entryFee, 10) || 0;

    try {
      const game = await createGame.mutateAsync({
        creatorId: userId,
        title: title.trim(),
        sportId,
        venueId,
        gameDate: selectedDate,
        endDate: endDateValue,
        startTime: `${startTime}:00`,
        endTime: endTimeValue,
        // Tournament capacity is teams × players-per-team; regular games use
        // the Max Players picker directly.
        maxPlayers: isTournament ? teams * perTeam : maxPlayers,
        skillLevel,
        visibility,
        gender,
        description: description.trim(),
        entryFee: fee,
        gameType,
        numberOfTeams: isTournament ? teams : null,
        playersPerTeam: isTournament ? perTeam : null,
      });
      navigation.replace("GameDetail", { gameId: game.id });
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error
          ? err.message
          : `Could not create ${isTournament ? "tournament" : "game"}. Please try again.`
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
        <Text className="text-base font-bold text-ink flex-1">
          {isTournament ? "Create Tournament" : "Create Game"}
        </Text>
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
        <SectionLabel title={isTournament ? "Tournament Title" : "Game Title"} required />
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
        <SectionLabel title={forcedTournament ? "Tournament Type" : "Game Type"} />
        {forcedTournament ? (
          <View className="bg-purple-50 self-start px-4 py-2 rounded-full">
            <Text className="text-purple-700 text-sm font-semibold">🏆 Tournament</Text>
          </View>
        ) : (
          <PillRow<GameType>
            options={[
              { label: "Regular", value: "REGULAR" },
              { label: "Tournament", value: "TOURNAMENT" },
            ]}
            value={gameType}
            onChange={setGameType}
          />
        )}

        {/* Venue */}
        <SectionLabel title="Venue" required />
        <VenueSearchField
          venues={venues}
          loading={sportId != null && venuesLoading}
          selectedVenueId={venueId}
          onSelect={(id) => setVenueId(id || null)}
          disabledReason={!sportId ? "Select a sport to see venues that offer it." : undefined}
        />

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
                onPress={() => {
                  setSelectedDate(d.iso);
                  // A time picked for a later date can be in the past once
                  // the user switches to today — clear it rather than leave
                  // an invalid selection sitting there.
                  if (startTime && d.iso === DAYS[0].iso && isTimeSlotPast(d.iso, startTime)) {
                    setStartTime(null);
                  }
                }}
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
          {TIME_SLOTS.filter(
            (t) => !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value))
          ).map((t) => {
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
        {isTournament ? (
          <PillRow
            options={TOURNAMENT_DURATIONS_DAYS.map((d) => ({
              label: d === 1 ? "1 Day" : `${d} Days`,
              value: String(d),
            }))}
            value={String(durationDays)}
            onChange={(v) => setDurationDays(parseInt(v, 10))}
          />
        ) : (
          <PillRow
            options={DURATIONS.map((d) => ({
              label: d === 1 ? "1 hr" : `${d} hrs`,
              value: String(d) as string,
            }))}
            value={String(duration)}
            onChange={(v) => setDuration(parseFloat(v))}
          />
        )}

        {/* Max Players (regular) / Teams config (tournament) */}
        {isTournament ? (
          <>
            <SectionLabel title="Number of Teams" required />
            <TextInput
              value={numberOfTeams}
              onChangeText={(t) => setNumberOfTeams(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="e.g. 8"
              className="border border-border rounded-xl px-4 py-3 text-ink"
              maxLength={3}
            />

            <SectionLabel title="Players per Team" required />
            <TextInput
              value={playersPerTeam}
              onChangeText={(t) => setPlayersPerTeam(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="e.g. 11"
              className="border border-border rounded-xl px-4 py-3 text-ink"
              maxLength={2}
            />
            <Text className="text-muted text-xs mt-1">
              A player must first form (or join) a team with the required number of
              members — the team is then submitted to you as host for approval.
            </Text>
          </>
        ) : (
          <>
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
          </>
        )}

        {/* Skill Level */}
        <SectionLabel title="Skill Level" required />
        <PillRow<SkillLevel>
          options={[
            { label: "Beginner", value: "BEGINNER" },
            { label: "Intermediate", value: "INTERMEDIATE" },
            { label: "Advanced", value: "ADVANCED" },
            { label: "Pro", value: "PRO" },
          ]}
          value={skillLevel}
          onChange={setSkillLevel}
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
        <SectionLabel title={isTournament ? "Entry Fee per Team (Rs)" : "Entry Fee (Rs)"} />
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
        <Text className="text-muted text-xs mt-1">
          {isTournament ? "Enter 0 for a free tournament" : "Enter 0 for a free game"}
        </Text>

        {/* Description */}
        <SectionLabel title="Description" required />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes for players (meeting point, equipment, etc.)"
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
