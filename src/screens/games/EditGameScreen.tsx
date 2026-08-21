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
import { useGameDetail, useUpdateGame } from "../../hooks/useGames";
import { useVenues } from "../../hooks/useVenues";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import type { GameDetail } from "../../lib/api/games";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import VenueSearchField from "../../components/VenueSearchField";
import FieldInput from "../../components/FieldInput";
import {
  TIME_SLOTS,
  DAYS,
  DURATIONS,
  TOURNAMENT_DURATIONS_DAYS,
  MAX_PLAYERS_OPTIONS,
  addMinutes,
  addDays,
  diffHours,
  diffDays,
  isTimeSlotPast,
} from "../../lib/gameFormHelpers";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";

type EditRoute = RouteProp<GamesStackParamList, "EditGame">;
type Nav = NativeStackNavigationProp<GamesStackParamList, "EditGame">;
type SkillLevel = Database["public"]["Enums"]["game_skill_level_type"];
type Visibility = Database["public"]["Enums"]["game_visibility_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];

// Shared "chip" look for the inline pickers below — same rounded +
// shadow-when-selected treatment as PillRow.
function chipStyle(selected: boolean, disabled?: boolean) {
  return {
    borderWidth: 1.5,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.primary : disabled ? "#F9FAFB" : "white",
    ...(selected
      ? {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 2,
        }
      : null),
  };
}

function toHHMM(t: string): string {
  return t.slice(0, 5);
}

// The date-strip only covers the next 14 days; if the game is already further
// out (or, in principle, in the past) than that, splice its own date in so the
// picker always has something selected instead of silently defaulting away.
function dateOptionsFor(gameDate: string) {
  if (DAYS.some((d) => d.iso === gameDate)) return DAYS;
  const [y, m, d] = gameDate.split("-").map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString("en-PK", { weekday: "short" });
  return [{ iso: gameDate, label: String(d), day }, ...DAYS];
}

// ── form (only mounted once the game has loaded, so state can init from it) ───

function EditGameForm({ game, minPlayers }: { game: GameDetail; minPlayers: number }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const updateGame = useUpdateGame();

  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: game.sport_id });
  const dateOptions = dateOptionsFor(game.game_date);

  const [title, setTitle] = useState(game.title);
  const [venueId, setVenueId] = useState<string | null>(game.venue_id);
  const [customVenueName, setCustomVenueName] = useState<string | null>(game.custom_venue_name);
  const [selectedDate, setSelectedDate] = useState(game.game_date);
  const [startTime, setStartTime] = useState(toHHMM(game.start_time));
  const [duration, setDuration] = useState(diffHours(toHHMM(game.start_time), toHHMM(game.end_time)));
  const isTournament = game.game_type === "TOURNAMENT";
  const [durationDays, setDurationDays] = useState(
    game.end_date ? diffDays(game.game_date, game.end_date) : 1
  );
  const [maxPlayers, setMaxPlayers] = useState(game.max_players);
  const [numberOfTeams, setNumberOfTeams] = useState(String(game.number_of_teams ?? ""));
  const [playersPerTeam, setPlayersPerTeam] = useState(String(game.players_per_team ?? ""));
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(game.skill_level);
  const [visibility, setVisibility] = useState<Visibility>(game.visibility);
  const [gender, setGender] = useState<Gender>(game.gender);
  const [description, setDescription] = useState(game.description ?? "");
  const [entryFee, setEntryFee] = useState(String(game.entry_fee));

  const handleSave = async () => {
    if (!isValidName(title)) {
      Alert.alert(
        "Invalid Title",
        `${isTournament ? "Tournament" : "Game"} title must be ${NAME_REQUIREMENT_HINT}.`
      );
      return;
    }

    const teams = parseInt(numberOfTeams, 10) || 0;
    const perTeam = parseInt(playersPerTeam, 10) || 0;
    if (isTournament && (teams < 2 || perTeam < 1)) {
      Alert.alert("Missing Info", "Please enter a number of teams (2+) and players per team.");
      return;
    }
    if (!isTournament && maxPlayers < minPlayers) {
      Alert.alert(
        "Too Few Slots",
        `${minPlayers} player${minPlayers !== 1 ? "s" : ""} already joined — max players can't go below that.`
      );
      return;
    }
    if (!venueId && !customVenueName) {
      Alert.alert("Missing Info", "Please select or enter a venue.");
      return;
    }
    if (!startTime) {
      Alert.alert("Missing Info", "Please select a start time.");
      return;
    }
    if (!skillLevel) {
      Alert.alert("Missing Info", "Please select a skill level.");
      return;
    }
    const endDateValue = isTournament ? addDays(selectedDate, durationDays - 1) : null;
    const endTimeValue = isTournament ? "23:59:59" : `${addMinutes(startTime, Math.round(duration * 60))}:00`;
    const fee = parseInt(entryFee, 10) || 0;

    try {
      await updateGame.mutateAsync({
        gameId: game.id,
        title: title.trim(),
        venueId,
        customVenueName,
        gameDate: selectedDate,
        endDate: endDateValue,
        startTime: `${startTime}:00`,
        endTime: endTimeValue,
        maxPlayers: isTournament ? teams * perTeam : maxPlayers,
        skillLevel,
        visibility,
        gender,
        description: description.trim(),
        entryFee: fee,
        numberOfTeams: isTournament ? teams : null,
        playersPerTeam: isTournament ? perTeam : null,
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
        <Text className="text-base font-bold text-ink flex-1">
          {isTournament ? "Edit Tournament" : "Edit Game"}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={updateGame.isPending}
          className="bg-primary rounded-xl px-4 py-2"
          style={{
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {updateGame.isPending ? (
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
        {/* Title */}
        <SectionLabel title={isTournament ? "Tournament Title" : "Game Title"} required />
        <FieldInput value={title} onChangeText={setTitle} placeholder="e.g. Saturday morning football" maxLength={80} />

        {/* Sport (locked) */}
        <SectionLabel title="Sport" />
        <View className="px-4 py-3 rounded-2xl bg-gray-100 flex-row items-center justify-between">
          <Text className="text-ink font-medium text-sm">{game.sports?.name}</Text>
          <Text className="text-muted text-xs">Can't be changed</Text>
        </View>

        {/* Venue */}
        <SectionLabel title="Venue" required />
        <VenueSearchField
          venues={venues}
          loading={venuesLoading}
          selectedVenueId={venueId}
          customVenueName={customVenueName}
          onSelect={(id) => setVenueId(id || null)}
          onSelectCustom={(name) => setCustomVenueName(name || null)}
        />

        {/* Date */}
        <SectionLabel title="Date" required />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dateOptions.map((d) => {
            const selected = selectedDate === d.iso;
            return (
              <Pressable
                key={d.iso}
                onPress={() => {
                  setSelectedDate(d.iso);
                  if (d.iso === DAYS[0].iso && isTimeSlotPast(d.iso, startTime)) {
                    setStartTime("");
                  }
                }}
                className="items-center px-3 py-2 rounded-2xl"
                style={chipStyle(selected)}
              >
                <Text className={`text-xs ${selected ? "text-white" : "text-muted"}`}>{d.day}</Text>
                <Text className={`text-base font-bold mt-0.5 ${selected ? "text-white" : "text-ink"}`}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Start Time */}
        <SectionLabel title="Start Time" required />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIME_SLOTS.filter(
            // A pre-filled time that's already past (e.g. editing an
            // ongoing game) stays in the list and selectable as-is — only
            // *other* past slots are removed going forward.
            (t) =>
              t.value === startTime ||
              !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value))
          ).map((t) => {
            const selected = startTime === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setStartTime(t.value)}
                className="px-3 py-2 rounded-2xl"
                style={chipStyle(selected)}
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
            options={DURATIONS.map((d) => ({ label: d === 1 ? "1 hr" : `${d} hrs`, value: String(d) as string }))}
            value={String(duration)}
            onChange={(v) => setDuration(parseFloat(v))}
          />
        )}

        {/* Max Players (regular) / Teams config (tournament) */}
        {isTournament ? (
          <>
            <SectionLabel title="Number of Teams" required />
            <FieldInput
              value={numberOfTeams}
              onChangeText={(t) => setNumberOfTeams(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="e.g. 8"
              maxLength={3}
            />

            <SectionLabel title="Players per Team" required />
            <FieldInput
              value={playersPerTeam}
              onChangeText={(t) => setPlayersPerTeam(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="e.g. 11"
              maxLength={2}
            />
          </>
        ) : (
          <>
            <SectionLabel title="Max Players" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {MAX_PLAYERS_OPTIONS.map((n) => {
                const selected = maxPlayers === n;
                const disabled = n < minPlayers;
                return (
                  <Pressable
                    key={n}
                    onPress={() => !disabled && setMaxPlayers(n)}
                    disabled={disabled}
                    className="w-12 py-2 rounded-2xl items-center"
                    style={chipStyle(selected, disabled)}
                  >
                    <Text className={`text-sm font-medium ${selected ? "text-white" : disabled ? "text-border" : "text-ink"}`}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {minPlayers > 0 && (
              <Text className="text-muted text-xs mt-1">
                {minPlayers} player{minPlayers !== 1 ? "s" : ""} already joined
              </Text>
            )}
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
        <FieldInput
          value={entryFee}
          onChangeText={(t) => setEntryFee(t.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholder="0"
          left={<Text className="text-muted mr-2">Rs</Text>}
        />
        <Text className="text-muted text-xs mt-1">
          {isTournament ? "Enter 0 for a free tournament" : "Enter 0 for a free game"}
        </Text>

        {/* Description */}
        <SectionLabel title="Description" />
        <FieldInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes for players (meeting point, equipment, etc.)"
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

export default function EditGameScreen() {
  const { params } = useRoute<EditRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: game, isLoading, error } = useGameDetail(params.gameId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center px-6">
        <Text className="text-ink font-semibold text-base mb-2">Game not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-primary font-medium">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const hasEnded =
    new Date(`${game.end_date ?? game.game_date}T${game.end_time}+05:00`).getTime() < Date.now();
  const isCancelled = game.status === "CANCELLED";

  if (game.creator_id !== userId || hasEnded || isCancelled) {
    return (
      <View className="flex-1 bg-gray-100">
        <View className="flex-row items-center px-4 pb-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
          <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <Text className="text-base font-bold text-ink">
            {game.game_type === "TOURNAMENT" ? "Edit Tournament" : "Edit Game"}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2 text-center">
            {game.creator_id !== userId
              ? `Only the host can edit this ${game.game_type === "TOURNAMENT" ? "tournament" : "game"}`
              : isCancelled
                ? `This ${game.game_type === "TOURNAMENT" ? "tournament" : "game"} has been cancelled`
                : `This ${game.game_type === "TOURNAMENT" ? "tournament" : "game"} has already ended`}
          </Text>
          <Text className="text-muted text-sm text-center">It can no longer be edited.</Text>
        </View>
      </View>
    );
  }

  const minPlayers = game.game_players.filter((p) => p.status === "JOINED").length;

  return <EditGameForm game={game} minPlayers={minPlayers} />;
}
