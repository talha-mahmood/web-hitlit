import { useMemo, useRef, useState } from "react";
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
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from "react-native";
import type * as ImagePicker from "expo-image-picker";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { useVenues } from "../../hooks/useVenues";
import { useCreateGame } from "../../hooks/useGames";
import { createTournamentTeamPlaceholders } from "../../lib/api/tournamentTeams";
import { createPools } from "../../lib/api/tournamentPools";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import VenueSearchField from "../../components/VenueSearchField";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import { HomeSportTile } from "../../components/HomeWideCards";
import { getSportImage } from "../../lib/sportImages";
import { useSelectPulse } from "../../lib/useSelectPulse";
import {
  TIME_SLOTS,
  DAYS,
  DURATIONS,
  TOURNAMENT_DURATIONS_DAYS,
  NUMBER_OF_TEAMS_OPTIONS,
  PLAYERS_PER_TEAM_OPTIONS,
  NUMBER_OF_GROUPS_OPTIONS,
  TEAMS_PER_GROUP_OPTIONS,
  addMinutesWithOverflow,
  addDays,
  isTimeSlotPast,
} from "../../lib/gameFormHelpers";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<GamesStackParamList, "CreateGame">,
  BottomTabNavigationProp<MainTabParamList>
>;
type CreateGameRoute = RouteProp<GamesStackParamList, "CreateGame">;
type SkillLevel = Database["public"]["Enums"]["game_skill_level_type"];
type Visibility = Database["public"]["Enums"]["game_visibility_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];
type GameType = Database["public"]["Enums"]["game_type_type"];
type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

// Knockout needs an even team count so every round pairs up cleanly, with
// no lingering odd team out. League can't have exactly 3 — round-robin math
// works for any other count, but this app's format specifically excludes 3.
// Pool's own team-count constraint depends on the group count too (see
// isValidGroupCount below), so it isn't checked here.
function isValidTeamCount(format: TournamentFormat | null, n: number): boolean {
  if (format === "KNOCKOUT") return n % 2 === 0;
  if (format === "LEAGUE") return n !== 3;
  return true;
}

// Pool's total team count is derived as groups × teams-per-group (picked
// separately below), so it's always evenly divisible by construction — the
// group count itself just needs to be even.
function isValidGroupCount(n: number): boolean {
  return n >= 2 && n % 2 === 0;
}

// 0-indexed spreadsheet-column-style letters: A, B, ... Z, AA, AB, ... — used
// for auto-generated team names so it still reads sensibly past 26 teams.
function indexToLetters(i: number): string {
  let n = i;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

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

// A light-green callout used for helper/explanatory text (format
// descriptions, the derived group-count math, etc.) — same visual language
// as the rest of the app's "info" callouts.
function InfoBox({ text }: { text: string }) {
  return (
    <View
      className="flex-row items-start rounded-2xl px-3.5 py-3 mt-2"
      style={{ backgroundColor: colors.primaryLight, gap: 8 }}
    >
      <Ionicons name="information-circle" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs" style={{ color: colors.primaryDark }}>
        {text}
      </Text>
    </View>
  );
}

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "KNOCKOUT", label: "Knockout", icon: "trophy" },
  { value: "LEAGUE", label: "League", icon: "grid-outline" },
  { value: "POOL", label: "Pool", icon: "people" },
];

const FORMAT_INFO: Record<TournamentFormat, string> = {
  KNOCKOUT: "In a knockout format, teams are eliminated after a single loss until only one champion remains.",
  LEAGUE: "In a league format, every team plays every other team, and the team with the best record wins.",
  POOL: "In a pool format, teams are divided into groups and play within their group. The top teams may advance to the next round (optional).",
};

function FormatCard({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center rounded-2xl py-4"
      style={{ borderWidth: 1.5, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : "white" }}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.primaryDark : colors.muted} />
      <Text
        className="text-sm font-semibold mt-2"
        style={{ color: selected ? colors.primaryDark : colors.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type StepKey = "details" | "format" | "teams" | "review";
const STEPS: { key: StepKey; n: number; label: string }[] = [
  { key: "details", n: 1, label: "Details" },
  { key: "format", n: 2, label: "Format" },
  { key: "teams", n: 3, label: "Teams" },
  { key: "review", n: 4, label: "Review" },
];

// A tap-to-jump progress tracker for the tournament form — the form itself
// stays one long scroll (not a paginated wizard), this just highlights
// whichever section is currently in view and lets a tap scroll straight to
// a section, same idea as an in-page anchor nav.
function StepTracker({
  activeStep,
  onPressStep,
}: {
  activeStep: number;
  onPressStep: (step: StepKey) => void;
}) {
  return (
    <View className="flex-row px-4 pb-3" style={{ gap: 4 }}>
      {STEPS.map((s) => {
        const done = activeStep > s.n;
        const current = activeStep === s.n;
        return (
          <Pressable key={s.key} onPress={() => onPressStep(s.key)} className="flex-1 items-center">
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 20, height: 20, backgroundColor: done || current ? colors.primary : "#E5E7EB" }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color="white" />
                ) : (
                  <Text className={`text-[11px] font-bold ${current ? "text-white" : "text-muted"}`}>{s.n}</Text>
                )}
              </View>
              <Text
                className={`text-xs ${current ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}`}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </View>
            <View
              style={{
                height: 3,
                borderRadius: 2,
                marginTop: 6,
                width: "100%",
                backgroundColor: current ? colors.primary : "transparent",
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CreateGameScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<CreateGameRoute>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createGame = useCreateGame();
  const { data: sports } = useSports();
  const scrollRef = useRef<ScrollView>(null);

  // Reached via the Tournaments section (Home card / Tournaments list "Create"
  // button) — game type is fixed, not a Regular/Tournament toggle.
  const forcedTournament = route.params?.gameType === "TOURNAMENT";

  const [title, setTitle] = useState("");
  const [iconAsset, setIconAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [gameType, setGameType] = useState<GameType>(forcedTournament ? "TOURNAMENT" : "REGULAR");
  const [sportId, setSportId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [customVenueName, setCustomVenueName] = useState<string | null>(null);
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: sportId ?? undefined });
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [numberOfTeams, setNumberOfTeams] = useState<number | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState<number | null>(null);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numberOfGroups, setNumberOfGroups] = useState<number | null>(null);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [teamsPerGroup, setTeamsPerGroup] = useState<number | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  // Visibility isn't a user-facing choice (removed from the form) — every
  // game/tournament created here is public, matching the games list query's
  // `.eq("visibility", "public")` filter.
  const visibility: Visibility = "public";
  const [gender, setGender] = useState<Gender>("mixed");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("0");

  // Scroll-linked progress tracker state — each section reports its own Y
  // offset once it mounts/lays out, and the active step is whichever
  // section's marker the scroll position has reached.
  const [sectionY, setSectionY] = useState<Record<StepKey, number>>({
    details: 0,
    format: Infinity,
    teams: Infinity,
    review: Infinity,
  });
  const [scrollY, setScrollY] = useState(0);
  const markSection = (key: StepKey) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setSectionY((prev) => (prev[key] === y ? prev : { ...prev, [key]: y }));
  };
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  };
  const activeStep = useMemo(() => {
    const y = scrollY + 140;
    if (y >= sectionY.review) return 4;
    if (y >= sectionY.teams) return 3;
    if (y >= sectionY.format) return 2;
    return 1;
  }, [scrollY, sectionY]);
  const scrollToStep = (key: StepKey) => {
    const y = sectionY[key];
    if (Number.isFinite(y)) scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
  };

  const handleSportChange = (id: string) => {
    setSportId(id);
    setVenueId(null); // venue list depends on sport, so a prior pick may no longer apply
    setCustomVenueName(null);
  };

  // Team names are always auto-generated ("Team A", "Team B", ...) rather
  // than typed by the host — this just resizes `teamNames` to match the
  // current total team count whenever it changes.
  const resizeTeamNames = (total: number | null) => {
    setTeamNames(total ? Array.from({ length: total }, (_, i) => `Team ${indexToLetters(i)}`) : []);
  };

  // KNOCKOUT/LEAGUE: team count is picked directly.
  const handleNumberOfTeamsChange = (n: number) => {
    setNumberOfTeams(n);
    resizeTeamNames(n);
  };

  // POOL: team count is derived (groups × teams-per-group), not picked
  // directly — recompute the total and resize both the group-name and
  // team-name slots whenever either factor changes. Group names are always
  // auto-generated ("Group 1", "Group 2", ...) rather than typed by the
  // host, so they're just regenerated here to match the new count.
  const handleNumberOfGroupsChange = (n: number) => {
    setNumberOfGroups(n);
    setGroupNames(Array.from({ length: n }, (_, i) => `Group ${i + 1}`));
    const total = teamsPerGroup ? n * teamsPerGroup : null;
    setNumberOfTeams(total);
    resizeTeamNames(total);
  };

  const handleTeamsPerGroupChange = (n: number) => {
    setTeamsPerGroup(n);
    const total = numberOfGroups ? numberOfGroups * n : null;
    setNumberOfTeams(total);
    resizeTeamNames(total);
  };

  // Changing format can make the already-selected team count invalid (e.g.
  // switching to Knockout with 3 teams already picked) — clear it rather
  // than leave a stale, now-invalid selection in place. Pool derives its
  // team count from groups × teams-per-group rather than a direct pick, so
  // switching to/from it clears whichever side no longer applies.
  const handleTournamentFormatChange = (format: TournamentFormat) => {
    setTournamentFormat(format);
    if (format === "POOL") {
      setNumberOfTeams(null);
      setTeamNames([]);
    } else {
      setNumberOfGroups(null);
      setGroupNames([]);
      setTeamsPerGroup(null);
      if (numberOfTeams !== null && !isValidTeamCount(format, numberOfTeams)) {
        setNumberOfTeams(null);
        setTeamNames([]);
      }
    }
  };

  const isTournament = gameType === "TOURNAMENT";
  const selectedSportName = sports?.find((s) => s.id === sportId)?.name ?? null;
  // A restricted game/tournament can only be created for the host's own
  // gender — every squad-filled team on it will need to match too (see
  // squad_fill_tournament_team), so offering a restriction the host
  // themselves doesn't satisfy would just be a dead end.
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [{ label: "Everyone", value: "mixed" }, { label: "Male Only", value: "male" }]
      : myGender === "female"
        ? [{ label: "Everyone", value: "mixed" }, { label: "Female Only", value: "female" }]
        : [{ label: "Everyone", value: "mixed" }];
  // Cricket's smallest real side is more than a single player — hide the
  // "1" cell from Players per Team for this sport only.
  const isCricketSport = (selectedSportName ?? "").toLowerCase().includes("cricket");
  const playersPerTeamOptions = isCricketSport
    ? PLAYERS_PER_TEAM_OPTIONS.filter((n) => n !== 1)
    : PLAYERS_PER_TEAM_OPTIONS;

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
    if (!venueId && !customVenueName) {
      Alert.alert("Missing Info", "Please select or enter a venue.");
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
    if (isTournament && !tournamentFormat) {
      Alert.alert("Missing Info", "Please select a tournament format (Knockout, League, or Pool).");
      return;
    }
    if (isTournament && tournamentFormat === "POOL" && (!teamsPerGroup || !numberOfGroups)) {
      Alert.alert("Missing Info", "Please select a number of teams in each group and a number of groups.");
      return;
    }
    const teams = numberOfTeams ?? 0;
    const perTeam = playersPerTeam ?? 0;
    if (isTournament && (teams < 2 || perTeam < 1)) {
      Alert.alert("Missing Info", "Please select a number of teams and players per team.");
      return;
    }
    if (!isTournament && perTeam < 1) {
      Alert.alert("Missing Info", "Please select players per team.");
      return;
    }
    // Team names are always auto-generated ("Team A", "Team B", ...), so
    // there's nothing to validate about them — just the team count itself.
    if (isTournament && tournamentFormat !== "POOL" && !isValidTeamCount(tournamentFormat, teams)) {
      Alert.alert(
        "Invalid Team Count",
        tournamentFormat === "KNOCKOUT"
          ? "Knockout tournaments need an even number of teams."
          : "League tournaments can't have exactly 3 teams. Please choose a different number."
      );
      return;
    }

    const trimmedGroupNames = groupNames.map((n) => n.trim());
    if (tournamentFormat === "POOL") {
      const groups = numberOfGroups ?? 0;
      if (!isValidGroupCount(groups)) {
        Alert.alert("Invalid Group Count", "Pool tournaments need an even number of groups.");
        return;
      }
      if (trimmedGroupNames.some((n) => !n)) {
        Alert.alert("Missing Info", "Please enter a name for every group.");
        return;
      }
      const uniqueGroupNames = new Set(trimmedGroupNames.map((n) => n.toLowerCase()));
      if (uniqueGroupNames.size !== trimmedGroupNames.length) {
        Alert.alert("Duplicate Group Names", "Group names must be unique.");
        return;
      }
    }

    // Regular games run start_time..end_time — normally on a single
    // game_date, but a late start (e.g. 11 PM + 1 hr) can legitimately run
    // past midnight, in which case end_date is bumped to the next day so
    // the stored end_time is still read relative to the right calendar day.
    // A tournament instead spans durationDays calendar days starting at
    // game_date; its last day (end_date) formally closes at 23:59:59 rather
    // than some fixed hour, since matches on the final day don't have a
    // predetermined end time the way a single game session does.
    const regularEnd = isTournament ? null : addMinutesWithOverflow(startTime, Math.round(duration * 60));
    const endDateValue = isTournament
      ? addDays(selectedDate, durationDays - 1)
      : regularEnd!.daysOverflow > 0
        ? addDays(selectedDate, regularEnd!.daysOverflow)
        : null;
    const endTimeValue = isTournament ? "23:59:59" : `${regularEnd!.time}:00`;
    const fee = parseInt(entryFee, 10) || 0;

    try {
      const game = await createGame.mutateAsync({
        creatorId: userId,
        title: title.trim(),
        sportId,
        venueId,
        customVenueName,
        gameDate: selectedDate,
        endDate: endDateValue,
        startTime: `${startTime}:00`,
        endTime: endTimeValue,
        // Tournament capacity is teams × players-per-team. Regular games
        // always default to 2 teams (no team names/rosters, just a flat
        // capacity), so it's players-per-team × 2.
        maxPlayers: isTournament ? teams * perTeam : perTeam * 2,
        skillLevel,
        visibility,
        gender,
        description: description.trim(),
        entryFee: fee,
        gameType,
        // Regular games always default to 2 teams now (no format/bracket —
        // team-based joining mirrors tournaments, but it's just one game).
        numberOfTeams: isTournament ? teams : 2,
        playersPerTeam: perTeam,
        tournamentFormat: isTournament ? tournamentFormat : null,
      });
      if (isTournament) {
        await createTournamentTeamPlaceholders(game.id, teamNames);
        if (tournamentFormat === "POOL") {
          await createPools(game.id, trimmedGroupNames);
        }
      } else {
        // Regular games skip the "create a team" step entirely — both teams
        // already exist the moment the game is created, ready to be joined
        // (individually or filled with a squad) right away.
        await createTournamentTeamPlaceholders(game.id, ["Team A", "Team B"]);
      }
      // The icon bucket's RLS requires the game to already exist (it checks
      // creator_id via the game row), so the upload can only happen after
      // creation succeeds — a picked icon sits as a local asset until now.
      if (iconAsset) {
        const { publicUrl } = await uploadImage(iconAsset, { bucket: "game-icons", pathPrefix: game.id });
        await supabase.from("games").update({ icon_url: publicUrl }).eq("id", game.id);
      }
      navigation.replace("GameDetail", { gameId: game.id });
    } catch (err) {
      Alert.alert(
        "Error",
        getFriendlyErrorMessage(err, `Could not create ${isTournament ? "tournament" : "game"}. Please try again.`)
      );
    }
  };

  const sportTileGap = 12;
  const sportTileWidth = (windowWidth - 40 - sportTileGap * 3) / 4;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-green-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View className="border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center px-4 pb-4">
          <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Bouncy>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">
              {isTournament ? "Create Tournament" : "Host a Game"}
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              {isTournament ? "Bring players together. Create. Compete. Enjoy!" : "Set up your game and invite players."}
            </Text>
          </View>
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
        {isTournament && <StepTracker activeStep={activeStep} onPressStep={scrollToStep} />}
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={64}
      >
        <View onLayout={markSection("details")} />

        {/* Custom icon banner — combines the icon-picker with a festive
            trophy/ribbon graphic, matching the reference design's single
            merged banner. Background is the exact same dark green as the
            Live Scoring header ("#0E4429"), so text/icons switch to white
            here instead of the dark-on-light treatment used elsewhere. */}
        <Pressable
          onPress={async () => {
            const assets = await pickImages({});
            if (assets[0]) setIconAsset(assets[0]);
          }}
          className="flex-row items-center rounded-2xl overflow-hidden mt-3 mb-1"
          style={{ backgroundColor: "#0E4429", minHeight: 112, ...cardShadow }}
        >
          <Ionicons
            name="ribbon"
            size={90}
            color="white"
            style={{ position: "absolute", right: -6, top: 4, opacity: 0.15, transform: [{ rotate: "18deg" }] }}
          />
          <Ionicons
            name="trophy"
            size={54}
            color="#F5B400"
            style={{ position: "absolute", right: 34, top: 18, transform: [{ rotate: "-6deg" }] }}
          />
          <Ionicons
            name="sparkles"
            size={14}
            color="white"
            style={{ position: "absolute", right: 108, top: 14, opacity: 0.6 }}
          />
          <Ionicons
            name="sparkles"
            size={10}
            color="white"
            style={{ position: "absolute", right: 90, top: 50, opacity: 0.5 }}
          />
          <View className="flex-row items-center flex-1 px-4 py-4" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 52, height: 52 }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 52, height: 52, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)", borderStyle: "dashed" }}
              >
                {iconAsset ? (
                  <Image
                    source={{ uri: iconAsset.uri }}
                    style={{ width: 44, height: 44, borderRadius: 22 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View className="items-center justify-center rounded-xl bg-white" style={{ width: 34, height: 34 }}>
                    <Ionicons name="camera" size={17} color="#0E4429" />
                  </View>
                )}
              </View>
              <View
                className="absolute items-center justify-center rounded-full bg-primary"
                style={{ width: 18, height: 18, bottom: 0, right: 0, borderWidth: 2, borderColor: "#0E4429" }}
              >
                <Ionicons name="add" size={11} color="white" />
              </View>
            </View>
            <View style={{ maxWidth: "62%" }}>
              <View className="flex-row items-center flex-wrap" style={{ gap: 4 }}>
                <Text className="font-bold text-base text-white">
                  {iconAsset ? "Change icon" : "Add a custom icon"}
                </Text>
                <Text className="text-xs text-white" style={{ opacity: 0.65 }}>
                  (optional)
                </Text>
              </View>
              <Text className="text-xs mt-1 text-white" style={{ opacity: 0.65 }}>
                Make your {isTournament ? "tournament" : "game"} stand out with a custom icon.
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Title */}
        <SectionLabel title={isTournament ? "Tournament Title" : "Game Title"} required icon="pencil-outline" compact />
        <FieldInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Saturday morning football"
          maxLength={80}
          right={
            title.length > 0 ? (
              <Pressable onPress={() => setTitle("")} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />

        {/* Sport */}
        <SectionLabel title="Sport" required icon="trophy-outline" compact />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sportTileGap }}>
          {(sports ?? []).map((s) => (
            <HomeSportTile
              key={s.id}
              name={s.name}
              width={sportTileWidth}
              selected={sportId === s.id}
              onPress={() => handleSportChange(s.id)}
            />
          ))}
        </ScrollView>

        {/* Game Type */}
        <SectionLabel title={forcedTournament ? "Tournament Type" : "Game Type"} icon="game-controller-outline" compact />
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
        <SectionLabel title="Venue" required icon="location-outline" compact />
        <VenueSearchField
          venues={venues}
          loading={sportId != null && venuesLoading}
          selectedVenueId={venueId}
          customVenueName={customVenueName}
          onSelect={(id) => setVenueId(id || null)}
          onSelectCustom={(name) => setCustomVenueName(name || null)}
          disabledReason={!sportId ? "Select a sport to see venues that offer it." : undefined}
          thumbnailSource={selectedSportName ? getSportImage(selectedSportName) : null}
        />
        {venueId && (
          <Pressable
            onPress={() => navigation.navigate("Venues", { screen: "VenueDetail", params: { venueId } })}
            className="flex-row items-center justify-between mt-2 px-1 py-1"
          >
            <Text className="text-primary text-sm font-medium">View venue details</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </Pressable>
        )}

        {/* Date */}
        <SectionLabel title="Date" required icon="calendar-outline" compact />
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
        <SectionLabel title="Start Time" required icon="time-outline" compact />
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
        <SectionLabel title="Duration" icon="timer-outline" compact />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {isTournament
            ? TOURNAMENT_DURATIONS_DAYS.map((d) => {
                const value = String(d);
                const selected = durationDays === d;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDurationDays(d)}
                    className="px-4 py-2.5 rounded-2xl"
                    style={chipStyle(selected)}
                  >
                    <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                      {d === 1 ? "1 Day" : `${d} Days`}
                    </Text>
                  </Pressable>
                );
              })
            : DURATIONS.map((d) => {
                const selected = duration === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDuration(d)}
                    className="px-4 py-2.5 rounded-2xl"
                    style={chipStyle(selected)}
                  >
                    <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
                      {d === 1 ? "1 hr" : `${d} hrs`}
                    </Text>
                  </Pressable>
                );
              })}
        </ScrollView>

        {/* Max Players (regular) / Teams config (tournament) */}
        {isTournament ? (
          <>
            <View onLayout={markSection("format")} />
            <SectionLabel title="Tournament Format" required icon="git-branch-outline" compact />
            <View className="flex-row" style={{ gap: 10 }}>
              {FORMAT_OPTIONS.map((f) => (
                <FormatCard
                  key={f.value}
                  icon={f.icon}
                  label={f.label}
                  selected={tournamentFormat === f.value}
                  onPress={() => handleTournamentFormatChange(f.value)}
                />
              ))}
            </View>
            {tournamentFormat && <InfoBox text={FORMAT_INFO[tournamentFormat]} />}

            {tournamentFormat === "POOL" ? (
              <>
                <SectionLabel title="Number of Teams in Each Group" required icon="people-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {TEAMS_PER_GROUP_OPTIONS.map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={teamsPerGroup === n}
                      onPress={() => handleTeamsPerGroupChange(n)}
                    />
                  ))}
                </ScrollView>

                <SectionLabel title="Number of Groups" required icon="layers-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {NUMBER_OF_GROUPS_OPTIONS.filter(isValidGroupCount).map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={numberOfGroups === n}
                      onPress={() => handleNumberOfGroupsChange(n)}
                    />
                  ))}
                </ScrollView>
                <InfoBox
                  text={
                    numberOfTeams != null && numberOfTeams > 0
                      ? `Pool tournaments need an even number of groups. ${numberOfGroups} groups × ${teamsPerGroup} teams each = ${numberOfTeams} teams total.`
                      : "Pool tournaments need an even number of groups."
                  }
                />

                <SectionLabel title="Players per Team" required icon="person-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {playersPerTeamOptions.map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={playersPerTeam === n}
                      onPress={() => setPlayersPerTeam(n)}
                    />
                  ))}
                </ScrollView>

              </>
            ) : (
              <>
                <SectionLabel title="Number of Teams" required icon="people-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {NUMBER_OF_TEAMS_OPTIONS.filter((n) => isValidTeamCount(tournamentFormat, n)).map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={numberOfTeams === n}
                      onPress={() => handleNumberOfTeamsChange(n)}
                    />
                  ))}
                </ScrollView>
                {tournamentFormat === "KNOCKOUT" && <InfoBox text="Knockout needs an even number of teams." />}
                {tournamentFormat === "LEAGUE" && (
                  <InfoBox text="League tournaments can't have exactly 3 teams." />
                )}
                <SectionLabel title="Players per Team" required icon="person-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {playersPerTeamOptions.map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={playersPerTeam === n}
                      onPress={() => setPlayersPerTeam(n)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <View onLayout={markSection("teams")} />

            <InfoBox text="Anyone can join an open team slot — a team joins the tournament automatically once it's full." />
          </>
        ) : (
          <>
            <SectionLabel title="Players per Team" required icon="person-outline" compact />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {playersPerTeamOptions.map((n) => (
                <CountChipItem
                  key={n}
                  n={n}
                  selected={playersPerTeam === n}
                  onPress={() => setPlayersPerTeam(n)}
                />
              ))}
            </ScrollView>
            <InfoBox text="Regular games default to 2 teams (Team A and Team B) — this sets how many players join each side." />
          </>
        )}

        {isTournament && <View onLayout={markSection("review")} />}

        {/* Skill Level */}
        <SectionLabel title="Skill Level" required icon="bar-chart-outline" compact />
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

        {/* Open To */}
        <SectionLabel title="Open To" icon="people-outline" compact />
        <PillRow<Gender> options={genderOptions} value={gender} onChange={setGender} />

        {/* Entry Fee */}
        <View className="flex-row items-center mb-2 mt-3">
          <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text className="font-semibold text-sm text-ink">
            {isTournament ? "Entry Fee per Team (Rs)" : "Entry Fee per Person (Rs)"}
          </Text>
        </View>
        <FieldInput
          value={entryFee}
          onChangeText={(t) => setEntryFee(t.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholder="0"
          left={<Text className="text-muted mr-2">Rs</Text>}
          right={
            entryFee !== "0" && entryFee.length > 0 ? (
              <Pressable onPress={() => setEntryFee("0")} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />
        <Text className="text-muted text-xs mt-1">
          {isTournament ? "Enter 0 for a free tournament" : "Enter 0 for a free game"}
        </Text>

        {/* Description */}
        <SectionLabel title="Description" icon="document-text-outline" compact />
        <View>
          <FieldInput
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 500))}
            placeholder="Add any additional details (meeting point, rules, prizes, etc.)"
            multiline
            numberOfLines={3}
            maxLength={500}
            style={{ height: 88, textAlignVertical: "top", paddingBottom: 20 }}
          />
          <Text className="text-muted text-xs" style={{ position: "absolute", right: 12, bottom: 8 }}>
            {description.length}/500
          </Text>
        </View>
        <Text className="text-muted text-xs mt-1">
          Add any additional details (meeting point, rules, prizes, etc.).
        </Text>

        <Pressable
          onPress={handleCreate}
          disabled={createGame.isPending}
          className="flex-row items-center justify-center rounded-2xl py-4 mt-6"
          style={{
            gap: 8,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          {createGame.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="trophy" size={18} color="white" />
              <Text className="text-white font-bold text-base">
                {isTournament ? "Post Tournament" : "Post Game"}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
