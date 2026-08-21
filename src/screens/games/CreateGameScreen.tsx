import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useCreateGame } from "../../hooks/useGames";
import { createTournamentTeamPlaceholders } from "../../lib/api/tournamentTeams";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import VenueSearchField from "../../components/VenueSearchField";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import SportsBackgroundDecor from "../../components/SportsBackgroundDecor";
import SportHeroBadge from "../../components/SportHeroBadge";
import IconPoolPreview from "../../components/IconPoolPreview";
import { useSelectPulse } from "../../lib/useSelectPulse";
import {
  TIME_SLOTS,
  DAYS,
  DURATIONS,
  TOURNAMENT_DURATIONS_DAYS,
  MAX_PLAYERS_OPTIONS,
  NUMBER_OF_TEAMS_OPTIONS,
  PLAYERS_PER_TEAM_OPTIONS,
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
type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

// Shared "chip" look for the inline pickers below (sport, date, time, max
// players) — same rounded + shadow-when-selected treatment as PillRow.
function chipStyle(selected: boolean, extra?: object) {
  return {
    borderWidth: 1.5,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.primary : "white",
    ...(selected
      ? {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 2,
        }
      : null),
    ...extra,
  };
}

// Sport/Date/Start Time/Max Players use this same plain-Pressable chip (no
// press-scale) as Duration and every other PillRow field — only the
// select-pulse "pop" (also used by PillRow) carries over as the animation,
// so these fields look and behave exactly like the rest of the form.
function SportChipItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const pulseStyle = useSelectPulse(selected);
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={onPress} className="px-4 py-2.5 rounded-2xl" style={chipStyle(selected)}>
        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
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
      <Pressable onPress={onPress} className="items-center px-3 py-2.5 rounded-2xl" style={chipStyle(selected)}>
        <Text className={`text-xs ${selected ? "text-white" : "text-muted"}`}>{day}</Text>
        <Text className={`text-base font-bold mt-0.5 ${selected ? "text-white" : "text-ink"}`}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function TimeChipItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const pulseStyle = useSelectPulse(selected);
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={onPress} className="px-3 py-2.5 rounded-2xl" style={chipStyle(selected)}>
        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function MaxPlayersChipItem({
  n,
  selected,
  onPress,
}: {
  n: number;
  selected: boolean;
  onPress: () => void;
}) {
  const pulseStyle = useSelectPulse(selected);
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={onPress} className="w-12 py-2.5 rounded-2xl items-center" style={chipStyle(selected)}>
        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{n}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Shared by the tournament-only "Number of Teams" / "Players per Team"
// pickers below — same chip look and pop animation as Max Players.
function CountChipItem({
  n,
  selected,
  onPress,
}: {
  n: number;
  selected: boolean;
  onPress: () => void;
}) {
  const pulseStyle = useSelectPulse(selected);
  return (
    <Animated.View style={pulseStyle}>
      <Pressable onPress={onPress} className="w-12 py-2.5 rounded-2xl items-center" style={chipStyle(selected)}>
        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>{n}</Text>
      </Pressable>
    </Animated.View>
  );
}

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
  const [numberOfTeams, setNumberOfTeams] = useState<number | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState<number | null>(null);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  // Visibility isn't a user-facing choice (removed from the form) — every
  // game/tournament created here is public, matching the games list query's
  // `.eq("visibility", "public")` filter.
  const visibility: Visibility = "public";
  const [gender, setGender] = useState<Gender>("mixed");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("0");

  const handleSportChange = (id: string) => {
    setSportId(id);
    setVenueId(null); // venue list depends on sport, so a prior pick may no longer apply
  };

  // Keep `teamNames` sized to match the selected team count, preserving
  // whatever the host already typed for the slots that still exist.
  const handleNumberOfTeamsChange = (n: number) => {
    setNumberOfTeams(n);
    setTeamNames((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  };

  const isTournament = gameType === "TOURNAMENT";
  const selectedSportName = sports?.find((s) => s.id === sportId)?.name ?? null;

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
    const teams = numberOfTeams ?? 0;
    const perTeam = playersPerTeam ?? 0;
    if (isTournament && (teams < 2 || perTeam < 1)) {
      Alert.alert("Missing Info", "Please select a number of teams (2+) and players per team.");
      return;
    }
    const trimmedTeamNames = teamNames.map((n) => n.trim());
    if (isTournament) {
      if (!tournamentFormat) {
        Alert.alert("Missing Info", "Please select a tournament format (Knockout or League).");
        return;
      }
      if (trimmedTeamNames.some((n) => !n)) {
        Alert.alert("Missing Info", "Please enter a name for every team.");
        return;
      }
      const uniqueNames = new Set(trimmedTeamNames.map((n) => n.toLowerCase()));
      if (uniqueNames.size !== trimmedTeamNames.length) {
        Alert.alert("Duplicate Team Names", "Team names must be unique.");
        return;
      }
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
        tournamentFormat: isTournament ? tournamentFormat : null,
      });
      if (isTournament) {
        await createTournamentTeamPlaceholders(game.id, trimmedTeamNames);
      }
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
      className="flex-1 bg-gray-100"
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
        <Text className="text-base font-bold text-ink flex-1">
          {isTournament ? "Create Tournament" : "Create Game"}
        </Text>
        <Pressable
          onPress={handleCreate}
          disabled={createGame.isPending}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          }}
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <SectionLabel title={isTournament ? "Tournament Title" : "Game Title"} required />
        <FieldInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Saturday morning football"
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
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {(sports ?? []).map((s) => (
            <SportChipItem
              key={s.id}
              label={s.name}
              selected={sportId === s.id}
              onPress={() => handleSportChange(s.id)}
            />
          ))}
        </View>

        {/* Game Type */}
        <SectionLabel title={forcedTournament ? "Tournament Type" : "Game Type"} />
        {forcedTournament ? (
          <View className="bg-purple-50 self-start px-4 py-2 rounded-2xl">
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
          {DAYS.map((d) => (
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

        {/* Start Time */}
        <SectionLabel title="Start Time" required />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {TIME_SLOTS.filter(
            (t) => !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value))
          ).map((t) => (
            <TimeChipItem
              key={t.value}
              label={t.label}
              selected={startTime === t.value}
              onPress={() => setStartTime(t.value)}
            />
          ))}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {NUMBER_OF_TEAMS_OPTIONS.map((n) => (
                <CountChipItem
                  key={n}
                  n={n}
                  selected={numberOfTeams === n}
                  onPress={() => handleNumberOfTeamsChange(n)}
                />
              ))}
            </ScrollView>
            <IconPoolPreview count={numberOfTeams ?? 0} icon="shield" />

            <SectionLabel title="Players per Team" required />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {PLAYERS_PER_TEAM_OPTIONS.map((n) => (
                <CountChipItem
                  key={n}
                  n={n}
                  selected={playersPerTeam === n}
                  onPress={() => setPlayersPerTeam(n)}
                />
              ))}
            </ScrollView>
            <IconPoolPreview count={playersPerTeam ?? 0} icon="account" />

            <SectionLabel title="Tournament Format" required />
            <PillRow<TournamentFormat>
              options={[
                { label: "Knockout", value: "KNOCKOUT" },
                { label: "League", value: "LEAGUE" },
              ]}
              value={tournamentFormat}
              onChange={setTournamentFormat}
            />

            {numberOfTeams != null && numberOfTeams > 0 && (
              <>
                <SectionLabel title="Team Names" required />
                <View style={{ gap: 8 }}>
                  {teamNames.map((name, i) => (
                    <FieldInput
                      key={i}
                      value={name}
                      onChangeText={(t) =>
                        setTeamNames((prev) => prev.map((n, idx) => (idx === i ? t : n)))
                      }
                      placeholder={`Team ${i + 1} name`}
                      maxLength={40}
                    />
                  ))}
                </View>
              </>
            )}

            <Text className="text-muted text-xs mt-3">
              Whoever joins an empty team slot first becomes its captain and can then
              recruit teammates — full teams are submitted to you as host for approval.
            </Text>
          </>
        ) : (
          <>
            <SectionLabel title="Max Players" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {MAX_PLAYERS_OPTIONS.map((n) => (
                <MaxPlayersChipItem
                  key={n}
                  n={n}
                  selected={maxPlayers === n}
                  onPress={() => setMaxPlayers(n)}
                />
              ))}
            </ScrollView>
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
