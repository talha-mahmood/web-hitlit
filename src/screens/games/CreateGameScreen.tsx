import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
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
import { colors, fonts } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import VenueSearchField from "../../components/VenueSearchField";
import Bouncy from "../../components/Bouncy";
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

// A bold, rounded text field with a color-accented focus ring — the same
// "advanced" treatment as the picker chips, applied to plain text inputs.
function FieldInput({
  focusColor = colors.primary,
  focusTint = colors.primaryLight,
  containerStyle,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  focusColor?: string;
  focusTint?: string;
  containerStyle?: object;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className="rounded-2xl px-4"
      style={{
        borderWidth: 1.5,
        borderColor: focused ? focusColor : colors.border,
        backgroundColor: focused ? focusTint : "white",
        ...containerStyle,
      }}
    >
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={colors.muted}
        style={[{ fontFamily: fonts.medium, paddingVertical: 12 }, props.style]}
        className="text-ink"
      />
    </View>
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Bouncy onPress={() => navigation.goBack()} className="mr-3 p-1" scaleTo={0.85}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <Text style={{ fontFamily: fonts.extrabold }} className="text-ink text-base flex-1">
          {isTournament ? "Create Tournament" : "Create Game"}
        </Text>
        <Bouncy
          onPress={handleCreate}
          disabled={createGame.isPending}
          className="rounded-2xl px-4 py-2.5"
          style={{
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {createGame.isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={{ fontFamily: fonts.bold }} className="text-white text-sm">
              Post
            </Text>
          )}
        </Bouncy>
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
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {(sports ?? []).map((s) => {
            const selected = sportId === s.id;
            return (
              <Bouncy
                key={s.id}
                onPress={() => handleSportChange(s.id)}
                className="rounded-2xl"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: selected ? colors.primary : "white",
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  ...(selected
                    ? {
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.22,
                        shadowRadius: 8,
                        elevation: 3,
                      }
                    : null),
                }}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-sm ${selected ? "text-white" : "text-ink"}`}
                >
                  {s.name}
                </Text>
              </Bouncy>
            );
          })}
        </View>

        {/* Game Type */}
        <SectionLabel title={forcedTournament ? "Tournament Type" : "Game Type"} />
        {forcedTournament ? (
          <View
            className="self-start px-4 py-2 rounded-2xl"
            style={{ backgroundColor: colors.violetLight }}
          >
            <Text style={{ fontFamily: fonts.bold, color: colors.violet }} className="text-sm">
              🏆 Tournament
            </Text>
          </View>
        ) : (
          <PillRow<GameType>
            options={[
              { label: "Regular", value: "REGULAR" },
              { label: "Tournament", value: "TOURNAMENT" },
            ]}
            value={gameType}
            onChange={setGameType}
            color={colors.amber}
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
              <Bouncy
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
                className="items-center rounded-2xl"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: selected ? colors.sky : "white",
                  borderWidth: 1.5,
                  borderColor: selected ? colors.sky : colors.border,
                  ...(selected
                    ? {
                        shadowColor: colors.sky,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.22,
                        shadowRadius: 8,
                        elevation: 3,
                      }
                    : null),
                }}
              >
                <Text
                  style={{ fontFamily: fonts.medium }}
                  className={`text-xs ${selected ? "text-white" : "text-muted"}`}
                >
                  {d.day}
                </Text>
                <Text
                  style={{ fontFamily: fonts.extrabold }}
                  className={`text-base mt-0.5 ${selected ? "text-white" : "text-ink"}`}
                >
                  {d.label}
                </Text>
              </Bouncy>
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
              <Bouncy
                key={t.value}
                onPress={() => setStartTime(t.value)}
                className="rounded-2xl"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: selected ? colors.amber : "white",
                  borderWidth: 1.5,
                  borderColor: selected ? colors.amber : colors.border,
                  ...(selected
                    ? {
                        shadowColor: colors.amber,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.22,
                        shadowRadius: 8,
                        elevation: 3,
                      }
                    : null),
                }}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-sm ${selected ? "text-white" : "text-ink"}`}
                >
                  {t.label}
                </Text>
              </Bouncy>
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
            color={colors.violet}
          />
        ) : (
          <PillRow
            options={DURATIONS.map((d) => ({
              label: d === 1 ? "1 hr" : `${d} hrs`,
              value: String(d) as string,
            }))}
            value={String(duration)}
            onChange={(v) => setDuration(parseFloat(v))}
            color={colors.violet}
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
              focusColor={colors.coral}
              focusTint={colors.coralLight}
            />

            <SectionLabel title="Players per Team" required />
            <FieldInput
              value={playersPerTeam}
              onChangeText={(t) => setPlayersPerTeam(t.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="e.g. 11"
              maxLength={2}
              focusColor={colors.coral}
              focusTint={colors.coralLight}
            />
            <Text style={{ fontFamily: fonts.medium }} className="text-muted text-xs mt-1">
              A player must first form (or join) a team with the required number of
              members — the team is then submitted to you as host for approval.
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
              {MAX_PLAYERS_OPTIONS.map((n) => {
                const selected = maxPlayers === n;
                return (
                  <Bouncy
                    key={n}
                    onPress={() => setMaxPlayers(n)}
                    className="items-center rounded-2xl"
                    style={{
                      width: 48,
                      paddingVertical: 10,
                      backgroundColor: selected ? colors.coral : "white",
                      borderWidth: 1.5,
                      borderColor: selected ? colors.coral : colors.border,
                      ...(selected
                        ? {
                            shadowColor: colors.coral,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.22,
                            shadowRadius: 8,
                            elevation: 3,
                          }
                        : null),
                    }}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className={`text-sm ${selected ? "text-white" : "text-ink"}`}
                    >
                      {n}
                    </Text>
                  </Bouncy>
                );
              })}
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
          color={colors.primary}
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
          color={colors.sky}
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
          color={colors.violet}
        />

        {/* Entry Fee */}
        <SectionLabel title={isTournament ? "Entry Fee per Team (Rs)" : "Entry Fee (Rs)"} />
        <FieldInput
          value={entryFee}
          onChangeText={(t) => setEntryFee(t.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholder="0"
          focusColor={colors.amber}
          focusTint={colors.amberLight}
        />
        <Text style={{ fontFamily: fonts.medium }} className="text-muted text-xs mt-1">
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
