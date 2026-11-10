import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
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
import Image from "../../components/images/OptimizedImage";
import type * as ImagePicker from "expo-image-picker";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSports } from "../../hooks/useSports";
import { isCricketFamily } from "../../lib/api/sports";
import { useVenues } from "../../hooks/useVenues";
import { useCreateGame } from "../../hooks/useGames";
import { createTournamentTeamPlaceholders } from "../../lib/api/tournamentTeams";
import { createPools } from "../../lib/api/tournamentPools";
import { generateMatches, generatePoolMatches } from "../../lib/api/tournamentMatches";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { colors, cardShadow } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import type { Database } from "../../types/database.types";
import { SectionLabel, PillRow } from "../../components/GameFormControls";
import VenueSearchField from "../../components/VenueSearchField";
import LocationMapPicker from "../../components/LocationMapPicker";
import { detectCurrentCoordinates, reverseGeocodeViaNominatim } from "../../lib/locationPicker";
import FieldInput from "../../components/FieldInput";
import Bouncy from "../../components/Bouncy";
import { HomeSportTile } from "../../components/HomeWideCards";
import GradientFill from "../../components/GradientFill";
import { getSportImage } from "../../lib/sportImages";
import { useSelectPulse } from "../../lib/useSelectPulse";
import {
  TIME_SLOTS,
  DAYS,
  DURATIONS,
  NUMBER_OF_TEAMS_OPTIONS,
  PLAYERS_PER_TEAM_OPTIONS,
  NUMBER_OF_GROUPS_OPTIONS,
  addMinutesWithOverflow,
  addDays,
  isTimeSlotPast,
} from "../../lib/gameFormHelpers";
import { isValidName, NAME_REQUIREMENT_HINT } from "../../lib/nameValidation";
import {
  computeKnockoutFixtures,
  distributeTeamsIntoGroups,
  leagueRoundsAndMatchesPerTeam,
} from "../../lib/tournamentFixtures";
import { pickImages, uploadImage } from "../../lib/upload";
import { supabase } from "../../lib/supabase";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import GeneratedEntityVisual from "../../components/GeneratedEntityVisual";
import { saveGeneratedVisualAsset } from "../../services/assets/assetGenerator";

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

// Knockout now generates a real bye-aware bracket (see
// knockoutBracketPairs in tournamentFixtures.ts) and League's round-robin
// was always correct for any count — neither format restricts team count
// beyond the basic "at least 2" every format needs.
function isValidTeamCount(_format: TournamentFormat | null, n: number): boolean {
  return n >= 2;
}

// Groups + Knockout balances teams across groups automatically, uneven
// splits allowed (see distributeTeamsIntoGroups) — any group count works
// as long as it doesn't exceed the team count.
function isValidGroupCount(n: number, totalTeams: number): boolean {
  return n >= 2 && n <= totalTeams;
}

// Default group count for a given team total — teams/3 clamped to a
// sensible 2-4 range; the host can still adjust it afterward.
function recommendGroupCount(totalTeams: number): number {
  return Math.min(4, Math.max(2, Math.round(totalTeams / 3)));
}

// How many teams get a first-round bye in a knockout bracket of this size —
// mirrors knockoutBracketPairs's own math without re-exporting it, just by
// counting the {teamB: null} fixtures it already produces.
function knockoutByeCount(n: number): number {
  return computeKnockoutFixtures(Array.from({ length: n }, (_, i) => String(i))).filter((f) => f.teamB === null)
    .length;
}

// Tournament "Duration" cells: a flat day count up to 6, then week/month
// markers instead of ever-larger day counts — still stores the exact same
// plain day count underneath (durationDays), just a friendlier label past
// 6 days (1 week = 7 days, 1 month = 30 days).
const TOURNAMENT_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 30] as const;

function tournamentDurationLabel(days: number): string {
  if (days === 7) return "1 week";
  if (days === 14) return "2 weeks";
  if (days === 21) return "3 weeks";
  if (days === 30) return "1 month";
  return `${days} day`;
}

// Parses a 'YYYY-MM-DD' string via local Y/M/D components, same as
// addDays/toLocalDateStr in gameFormHelpers — never via `new Date(iso)`
// directly, which treats it as UTC and can shift the displayed day
// depending on the device's timezone.
function formatDateIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PK", { month: "short", day: "numeric" });
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
    borderRadius: 16,
    borderColor: selected ? colors.primary : colors.border,
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

// Shared fill for the Sport/Date/Time/Count chip Pressables below — a
// selected chip renders the brand gradient, an unselected one stays flat
// white, same look as before just with a real gradient instead of a flat
// green.
function ChipFill({
  selected,
  className,
  children,
}: {
  selected: boolean;
  className: string;
  children: ReactNode;
}) {
  if (selected) {
    return <GradientFill className={className}>{children}</GradientFill>;
  }
  return (
    <View className={className} style={{ backgroundColor: colors.surface }}>
      {children}
    </View>
  );
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
      <Pressable onPress={onPress} style={chipStyle(selected)}>
        <ChipFill selected={selected} className="items-center px-3 py-2.5 rounded-2xl">
          <Text className={`text-xs ${selected ? "text-jazba-white" : "text-muted"}`}>{day}</Text>
          <Text className={`text-base font-bold mt-0.5 ${selected ? "text-jazba-white" : "text-ink"}`}>
            {label}
          </Text>
        </ChipFill>
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
      <Pressable onPress={onPress} style={chipStyle(selected)}>
        <ChipFill selected={selected} className="px-3 py-2.5 rounded-2xl">
          <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>
            {label}
          </Text>
        </ChipFill>
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
      <Pressable onPress={onPress} style={chipStyle(selected)}>
        <ChipFill selected={selected} className="w-12 py-2.5 rounded-2xl items-center">
          <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>{n}</Text>
        </ChipFill>
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

// The label shown here changed from "Pool" to "Groups + Knockout" for
// clarity — the stored value stays "POOL" everywhere (DB enum,
// tournamentFixtures.ts, TOURNAMENT_FORMAT_LABEL) so existing tournaments
// are never silently reinterpreted.
const FORMAT_OPTIONS: { value: TournamentFormat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "KNOCKOUT", label: "Knockout", icon: "trophy" },
  { value: "LEAGUE", label: "League", icon: "grid-outline" },
  { value: "POOL", label: "Groups + Knockout", icon: "people" },
  { value: "MANUAL", label: "Manual", icon: "construct-outline" },
];

// One-line taglines shown directly on each format card.
const FORMAT_TAGLINE: Record<TournamentFormat, string> = {
  KNOCKOUT: "Lose once and you're out.",
  LEAGUE: "Everyone plays everyone.",
  POOL: "Play in groups, then reach the final.",
  MANUAL: "You control every matchup and stage.",
};

const FORMAT_INFO: Record<TournamentFormat, string> = {
  KNOCKOUT: "In a knockout format, teams are eliminated after a single loss until only one champion remains.",
  LEAGUE: "In a league format, every team plays every other team, and the team with the best record wins.",
  POOL: "In a pool format, teams are divided into groups and play within their group. The top teams may advance to the next round (optional).",
  MANUAL: "In a manual format, you add every match by hand across any stages you name (e.g. Quarter-Final, Semi-Final, Final), and decide which teams qualify, are knocked out, or become champion.",
};

function FormatCard({
  icon,
  label,
  tagline,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tagline: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl px-4 py-3.5"
      style={{
        gap: 12,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryLight : colors.surface,
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: selected ? colors.surface : colors.surfaceOverlay }}
      >
        <Ionicons name={icon} size={19} color={selected ? colors.primaryDark : colors.muted} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold" style={{ color: selected ? colors.primaryDark : colors.ink }}>
          {label}
        </Text>
        <Text className="text-xs mt-0.5" style={{ color: selected ? colors.primaryDark : colors.muted }}>
          {tagline}
        </Text>
      </View>
      {selected && (
        <GradientFill className="items-center justify-center rounded-full" style={{ width: 22, height: 22 }}>
          <Ionicons name="checkmark" size={14} color="white" />
        </GradientFill>
      )}
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
              {done || current ? (
                <GradientFill className="items-center justify-center rounded-full" style={{ width: 20, height: 20 }}>
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="white" />
                  ) : (
                    <Text className="text-[11px] font-bold text-jazba-white">{s.n}</Text>
                  )}
                </GradientFill>
              ) : (
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 20, height: 20, backgroundColor: colors.border }}
                >
                  <Text className="text-[11px] font-bold text-muted">{s.n}</Text>
                </View>
              )}
              <Text
                className={`text-xs ${current ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}`}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </View>
            {current ? (
              <GradientFill style={{ height: 3, borderRadius: 2, marginTop: 6, width: "100%" }} />
            ) : (
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  marginTop: 6,
                  width: "100%",
                  backgroundColor: "transparent",
                }}
              />
            )}
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
  // button) — game type is fixed, not a Regular/Tournament toggle. The form
  // itself no longer shows a Game Type field at all; this is just read from
  // the route the host arrived through (Host Game vs Host Tournament).
  const forcedTournament = route.params?.gameType === "TOURNAMENT";

  const [title, setTitle] = useState("");
  const [iconAsset, setIconAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const gameType: GameType = forcedTournament ? "TOURNAMENT" : "REGULAR";
  const [sportId, setSportId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [customVenueName, setCustomVenueName] = useState<string | null>(null);
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: sportId ?? undefined });
  // "Enter Location Manually" — hides the app's venue list entirely and
  // shows an OpenStreetMap picker instead; confirming a pin reverse-geocodes
  // it straight into customVenueName (see games_venue_or_custom_check —
  // this is still the same custom-venue path, just with coordinates too).
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [customVenueLat, setCustomVenueLat] = useState<number | null>(null);
  const [customVenueLng, setCustomVenueLng] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(1);
  // Tournament-only: how many hours play runs each day.
  const [hoursPerDay, setHoursPerDay] = useState<number>(1);
  const HOURS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
  const [numberOfTeams, setNumberOfTeams] = useState<number | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState<number | null>(null);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numberOfGroups, setNumberOfGroups] = useState<number | null>(null);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState<number | null>(null);
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
    setManualLocationMode(false);
    setCustomVenueLat(null);
    setCustomVenueLng(null);
  };

  const handleToggleManualLocation = async () => {
    if (manualLocationMode) {
      // Switching back to the app's own venue list — drop whatever manual
      // pick was made.
      setManualLocationMode(false);
      setCustomVenueName(null);
      setCustomVenueLat(null);
      setCustomVenueLng(null);
      return;
    }
    setVenueId(null);
    setCustomVenueName(null);
    setManualLocationMode(true);
    setLocatingDevice(true);
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
  };

  const handleConfirmMapLocation = async (lat: number, lng: number) => {
    setConfirmingLocation(true);
    try {
      const label = await reverseGeocodeViaNominatim(lat, lng);
      setCustomVenueName(label);
      setCustomVenueLat(lat);
      setCustomVenueLng(lng);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not look up an address for this location."));
    } finally {
      setConfirmingLocation(false);
    }
  };

  // Team names are always auto-generated ("Team A", "Team B", ...) rather
  // than typed by the host — this just resizes `teamNames` to match the
  // current total team count whenever it changes.
  const resizeTeamNames = (total: number | null) => {
    setTeamNames(total ? Array.from({ length: total }, (_, i) => `Team ${indexToLetters(i)}`) : []);
  };

  // Team count is always picked directly now, including for Groups +
  // Knockout — picking it (re-)recommends a group count so the host sees a
  // sensible default split immediately, adjustable via the groups picker.
  const handleNumberOfTeamsChange = (n: number) => {
    setNumberOfTeams(n);
    resizeTeamNames(n);
    if (tournamentFormat === "POOL") {
      const recommended = recommendGroupCount(n);
      setNumberOfGroups(recommended);
      setGroupNames(Array.from({ length: recommended }, (_, i) => `Group ${i + 1}`));
    }
  };

  // Group names are always auto-generated ("Group 1", "Group 2", ...)
  // rather than typed by the host, so they're just regenerated here to
  // match the new count.
  const handleNumberOfGroupsChange = (n: number) => {
    setNumberOfGroups(n);
    setGroupNames(Array.from({ length: n }, (_, i) => `Group ${i + 1}`));
  };

  // Changing format can make the already-selected team count invalid (e.g.
  // switching to Knockout with 3 teams already picked) — clear it rather
  // than leave a stale, now-invalid selection in place. Pool derives its
  // team count from groups × teams-per-group rather than a direct pick, so
  // switching to/from it clears whichever side no longer applies.
  const handleTournamentFormatChange = (format: TournamentFormat) => {
    setTournamentFormat(format);
    setNumberOfGroups(null);
    setGroupNames([]);
    setQualifiersPerGroup(null);
    // Groups + Knockout needs at least 4 teams (2 groups of 2) to make sense
    // — a count already picked under Knockout/League might not clear that bar.
    if (numberOfTeams !== null && (!isValidTeamCount(format, numberOfTeams) || (format === "POOL" && numberOfTeams < 4))) {
      setNumberOfTeams(null);
      setTeamNames([]);
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
  const isCricketSport = isCricketFamily(selectedSportName);
  const isFootballSport = (selectedSportName ?? "").toLowerCase().includes("football");
  // Every other sport (padel, tennis, badminton, pickleball, table tennis)
  // only ever has a team of 1 or 2 — no point scrolling through the full
  // 1-20 grid for those.
  const playersPerTeamOptions = isCricketSport
    ? PLAYERS_PER_TEAM_OPTIONS.filter((n) => n !== 1)
    : !isFootballSport && selectedSportName
      ? PLAYERS_PER_TEAM_OPTIONS.slice(0, 2)
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
      Alert.alert("Missing Info", "Please select a tournament format (Knockout, League, Pool, or Manual).");
      return;
    }
    if (isTournament && tournamentFormat === "POOL" && (!numberOfGroups || !qualifiersPerGroup)) {
      Alert.alert("Missing Info", "Please select a number of groups and how many teams qualify from each.");
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

    const trimmedGroupNames = groupNames.map((n) => n.trim());
    if (tournamentFormat === "POOL") {
      const groups = numberOfGroups ?? 0;
      if (!isValidGroupCount(groups, teams)) {
        Alert.alert("Invalid Group Count", "Please choose a number of groups no larger than the team count.");
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
    // A single-day tournament works the same way: start time + hours per
    // day fully determines its one and only day's end time. A multi-day
    // tournament's last day (end_date) instead formally closes at 23:59:59
    // rather than some fixed hour, since matches on the final day don't
    // have a predetermined end time the way a single day's session does.
    const regularEnd = isTournament ? null : addMinutesWithOverflow(startTime, Math.round(duration * 60));
    const tournamentSingleDayEnd =
      isTournament && durationDays === 1 ? addMinutesWithOverflow(startTime, hoursPerDay * 60) : null;
    const endDateValue = isTournament
      ? durationDays === 1
        ? tournamentSingleDayEnd!.daysOverflow > 0
          ? addDays(selectedDate, tournamentSingleDayEnd!.daysOverflow)
          : null
        : addDays(selectedDate, durationDays - 1)
      : regularEnd!.daysOverflow > 0
        ? addDays(selectedDate, regularEnd!.daysOverflow)
        : null;
    const endTimeValue = isTournament
      ? durationDays === 1
        ? `${tournamentSingleDayEnd!.time}:00`
        : "23:59:59"
      : `${regularEnd!.time}:00`;
    const fee = parseInt(entryFee, 10) || 0;
    let navigatedAway = false;

    try {
      const game = await createGame.mutateAsync({
        creatorId: userId,
        title: title.trim(),
        sportId,
        venueId,
        customVenueName,
        customVenueLat,
        customVenueLng,
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
        dailyHours: isTournament ? hoursPerDay : null,
        poolQualifiersPerGroup: isTournament && tournamentFormat === "POOL" ? qualifiersPerGroup : null,
      });
      // Navigate the instant the core row exists — team placeholders, match
      // generation, and the icon upload below all finish in the background
      // while the detail screen is already open, showing its own skeleton
      // and filling in via its existing realtime subscriptions (team slots,
      // matches, icon) rather than keeping the host staring at this
      // screen's button spinner for every one of those extra steps.
      navigation.replace("GameDetail", { gameId: game.id });
      navigatedAway = true;
      if (isTournament) {
        // Team slots (and, for Pool, their group assignment) are all decided
        // at creation time, so the fixtures can be generated immediately
        // too — the host no longer has to come back and tap "Generate
        // Matches" once every roster fills up; the match list is there from
        // the start, with scoring buttons on each card gated per-match at
        // click time (see TournamentMatchesScreen's requireTeamsReady).
        if (tournamentFormat === "POOL") {
          const createdPools = await createPools(game.id, trimmedGroupNames);
          const groupSizes = distributeTeamsIntoGroups(teams, createdPools.length);
          const poolIds: string[] = [];
          createdPools.forEach((pool, gi) => {
            for (let k = 0; k < groupSizes[gi]; k++) poolIds.push(pool.id);
          });
          const createdTeams = await createTournamentTeamPlaceholders(game.id, teamNames, poolIds);
          await generatePoolMatches(
            game.id,
            createdPools.map((pool) => ({
              poolId: pool.id,
              teams: createdTeams.filter((t) => t.pool_id === pool.id).map((t) => ({ id: t.id, name: t.name })),
            }))
          );
        } else if (tournamentFormat === "MANUAL") {
          // Manual format has no auto-computed pairing — the host adds
          // every match by hand from the Matches panel, so only the team
          // slots are created here.
          await createTournamentTeamPlaceholders(game.id, teamNames);
        } else {
          const createdTeams = await createTournamentTeamPlaceholders(game.id, teamNames);
          await generateMatches(
            game.id,
            tournamentFormat!,
            createdTeams.map((t) => ({ id: t.id, name: t.name }))
          );
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
      } else {
        try {
          const publicUrl = await saveGeneratedVisualAsset({
            id: game.id,
            name: game.title,
            sport: selectedSportName,
            kind: isTournament ? "tournament" : "game",
          }, { bucket: "game-icons", folder: game.id });
          const { error: iconUpdateError } = await supabase.from("games").update({ icon_url: publicUrl }).eq("id", game.id);
          if (iconUpdateError) throw iconUpdateError;
        } catch {
          // Use the same deterministic local design if storage is unavailable.
        }
      }
    } catch (err) {
      Alert.alert(
        "Error",
        navigatedAway
          ? getFriendlyErrorMessage(
              err,
              `The ${isTournament ? "tournament" : "game"} was created, but finishing setup (teams/matches${iconAsset ? "/icon" : ""}) failed. You can keep going from its detail page.`
            )
          : getFriendlyErrorMessage(err, `Could not create ${isTournament ? "tournament" : "game"}. Please try again.`)
      );
    }
  };

  const sportTileGap = 12;
  const sportTileWidth = (windowWidth - 40 - sportTileGap * 3) / 4;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app"
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
              {isTournament ? "Bring players together and compete" : "Invite players to your game"}
            </Text>
          </View>
          <Pressable
            onPress={handleCreate}
            disabled={createGame.isPending}
            style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <GradientFill className="rounded-xl px-4 py-2">
              {createGame.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-jazba-white font-semibold text-sm">Post</Text>
              )}
            </GradientFill>
          </Pressable>
        </View>
        {isTournament && <StepTracker activeStep={activeStep} onPressStep={scrollToStep} />}
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 260 }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={64}
      >
        <View onLayout={markSection("details")} />

        {/* Custom icon banner — combines the icon-picker with a festive
            trophy/ribbon graphic, matching the reference design's single
            merged banner. Background is the same brand gradient as the
            Live Scoring header, so text/icons switch to white here instead
            of the dark-on-light treatment used elsewhere. */}
        <Pressable
          onPress={async () => {
            const assets = await pickImages({});
            if (assets[0]) setIconAsset(assets[0]);
          }}
          className="rounded-2xl overflow-hidden mt-3 mb-1"
          style={{ ...cardShadow }}
        >
        <GradientFill className="flex-row items-center" style={{ minHeight: 112 }}>
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
                  <GeneratedEntityVisual
                    id={title.trim() || `${isTournament ? "tournament" : "game"}-${selectedSportName ?? "sport"}`}
                    name={title.trim() || (isTournament ? "Your Tournament" : "Your Game")}
                    sport={selectedSportName}
                    kind={isTournament ? "tournament" : "game"}
                    size={44}
                    style={{ borderRadius: 22 }}
                  />
                )}
              </View>
              <GradientFill
                className="absolute items-center justify-center rounded-full"
                style={{ width: 18, height: 18, bottom: 0, right: 0, borderWidth: 2, borderColor: "#07301D" }}
              >
                <Ionicons name="add" size={11} color="white" />
              </GradientFill>
            </View>
            <View style={{ maxWidth: "62%" }}>
              <View className="flex-row items-center flex-wrap" style={{ gap: 4 }}>
                <Text className="font-bold text-base text-jazba-white">
                  {iconAsset ? "Change icon" : "Upload custom icon"}
                </Text>
                <Text className="text-xs text-jazba-white" style={{ opacity: 0.65 }}>
                  (optional)
                </Text>
              </View>
              <Text className="text-xs mt-1 text-jazba-white" style={{ opacity: 0.65 }}>
                A generated {isTournament ? "tournament emblem" : "game badge"} is included. You can upload your own.
              </Text>
            </View>
          </View>
        </GradientFill>
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

        {/* Venue */}
        <SectionLabel title="Venue" required icon="location-outline" compact />
        {/* Prominent, right above the field — switching modes only ever
            hides/shows the app's venue list; it never changes anything
            else about the form. */}
        <Pressable
          onPress={handleToggleManualLocation}
          className="flex-row items-center self-start rounded-full px-3.5 py-2 mb-2"
          style={{ gap: 6, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary }}
        >
          <Ionicons name={manualLocationMode ? "list-outline" : "map-outline"} size={15} color={colors.primaryDark} />
          <Text className="text-sm font-semibold" style={{ color: colors.primaryDark }}>
            {manualLocationMode ? "Choose from app venues instead" : "Enter Location Manually"}
          </Text>
        </Pressable>
        {manualLocationMode ? (
          <>
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
                selectedLabel={customVenueName}
              />
            )}
            {/* The map's own reverse-geocoded label isn't always exact (an
                unmapped building, a generic area name, ...) — once a spot is
                picked, let the host type over it with the real address
                instead. Pre-filled with whatever was auto-detected so
                there's nothing to redo when it's already correct. */}
            {customVenueName && (
              <View className="mt-3">
                <Text className="text-ink text-sm font-semibold mb-1.5">
                  Address <Text className="text-muted font-normal">(optional — edit if this isn't exact)</Text>
                </Text>
                <FieldInput
                  value={customVenueName}
                  onChangeText={setCustomVenueName}
                  placeholder="Enter the exact address"
                  multiline
                />
              </View>
            )}
          </>
        ) : (
          <>
            <VenueSearchField
              venues={venues}
              loading={venuesLoading}
              selectedVenueId={venueId}
              customVenueName={customVenueName}
              onSelect={(id) => setVenueId(id || null)}
              // No onSelectCustom here on purpose — unlike EditGameScreen,
              // Create already has a proper "Enter Location Manually" flow
              // (the map picker below) for a venue that isn't in the app's
              // list, so this field must only ever accept a real venue picked
              // from its own dropdown, never arbitrary typed text.
              //
              // No disabledReason either — useVenues already searches across
              // every sport's venues when no sport is picked yet (fetchVenues
              // only filters by sportId when one is actually passed), so
              // there's nothing to block here; a host can search venues
              // before or after choosing a sport.
              thumbnailSource={selectedSportName ? getSportImage(selectedSportName) : null}
            />
            {venueId && (
              <Pressable
                onPress={() => navigation.navigate("VenueDetail", { venueId })}
                className="flex-row items-center justify-between mt-2 px-1 py-1"
              >
                <Text className="text-primary text-sm font-medium">View venue details</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.primary} />
              </Pressable>
            )}
          </>
        )}
        {/* Date */}
        <SectionLabel title="Date" required icon="calendar-outline" compact />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
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

        {/* Tournaments: Duration (in days) first, then Start Time (Each
            Day) and Hours (Each Day). Regular games: Start Time, then
            Duration (in hours). */}
        {isTournament && (
          <>
            <SectionLabel title="Duration" icon="timer-outline" compact />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TOURNAMENT_DURATION_OPTIONS.map((d) => {
                const value = String(d);
                const selected = durationDays === d;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDurationDays(d)}
                    style={chipStyle(selected)}
                  >
                    <ChipFill selected={selected} className="px-4 py-2.5 rounded-2xl">
                      <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>
                        {tournamentDurationLabel(d)}
                      </Text>
                    </ChipFill>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <SectionLabel
          title={isTournament ? "Start Time (Each Day)" : "Start Time"}
          required
          icon="time-outline"
          compact
        />
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

        {isTournament ? (
          <>
            {/* Hours (Each Day) — tournament only */}
            <SectionLabel title="Hours (Each Day)" icon="hourglass-outline" compact />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {HOURS_PER_DAY_OPTIONS.map((h) => {
                const selected = hoursPerDay === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setHoursPerDay(h)}
                    style={chipStyle(selected)}
                  >
                    <ChipFill selected={selected} className="px-4 py-2.5 rounded-2xl">
                      <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>
                        {h === 1 ? "1 hr" : `${h} hrs`}
                      </Text>
                    </ChipFill>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            {/* Duration */}
            <SectionLabel title="Duration" icon="timer-outline" compact />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {DURATIONS.map((d) => {
                const selected = duration === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDuration(d)}
                    style={chipStyle(selected)}
                  >
                    <ChipFill selected={selected} className="px-4 py-2.5 rounded-2xl">
                      <Text className={`text-sm font-medium ${selected ? "text-jazba-white" : "text-ink"}`}>
                        {d === 1 ? "1 hr" : `${d} hrs`}
                      </Text>
                    </ChipFill>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Max Players (regular) / Teams config (tournament) */}
        {isTournament ? (
          <>
            <View onLayout={markSection("format")} />
            <SectionLabel title="Tournament Format" required icon="git-branch-outline" compact />
            <View style={{ gap: 10 }}>
              {FORMAT_OPTIONS.map((f) => (
                <FormatCard
                  key={f.value}
                  icon={f.icon}
                  label={f.label}
                  tagline={FORMAT_TAGLINE[f.value]}
                  selected={tournamentFormat === f.value}
                  onPress={() => handleTournamentFormatChange(f.value)}
                />
              ))}
            </View>
            {tournamentFormat && <InfoBox text={FORMAT_INFO[tournamentFormat]} />}

            {tournamentFormat === "POOL" ? (
              <>
                <SectionLabel title="Total Number of Teams" required icon="people-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {NUMBER_OF_TEAMS_OPTIONS.filter((n) => n >= 4).map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={numberOfTeams === n}
                      onPress={() => handleNumberOfTeamsChange(n)}
                    />
                  ))}
                </ScrollView>

                <SectionLabel title="Number of Groups" required icon="layers-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {NUMBER_OF_GROUPS_OPTIONS.filter((n) => isValidGroupCount(n, numberOfTeams ?? 0)).map((n) => (
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
                    numberOfTeams != null && numberOfGroups != null && numberOfGroups > 0
                      ? `Suggested split: ${distributeTeamsIntoGroups(numberOfTeams, numberOfGroups).join(" + ")} teams across ${numberOfGroups} groups.`
                      : "Pick a team count to see a suggested group split."
                  }
                />

                <SectionLabel title="Teams Qualifying per Group" required icon="trophy-outline" compact />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {[1, 2].map((n) => (
                    <CountChipItem
                      key={n}
                      n={n}
                      selected={qualifiersPerGroup === n}
                      onPress={() => setQualifiersPerGroup(n)}
                    />
                  ))}
                </ScrollView>
                <InfoBox text="The top team(s) from each group advance to a knockout stage." />

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
                {tournamentFormat === "KNOCKOUT" && numberOfTeams != null && (
                  <InfoBox
                    text={
                      knockoutByeCount(numberOfTeams) > 0
                        ? `${knockoutByeCount(numberOfTeams)} team(s) get a bye in round 1 — every team still plays ${numberOfTeams - 1 > 0 ? "its way to a single champion" : "on"} across ${numberOfTeams - 1} total matches.`
                        : `No byes needed — ${numberOfTeams - 1} total matches to crown a champion.`
                    }
                  />
                )}
                {tournamentFormat === "LEAGUE" && numberOfTeams != null && (
                  <InfoBox
                    text={`${leagueRoundsAndMatchesPerTeam(numberOfTeams).matchesPerTeam} matches per team across ${leagueRoundsAndMatchesPerTeam(numberOfTeams).rounds} rounds.`}
                  />
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

        {isTournament && (
          <View className="rounded-2xl p-4 mt-6" style={{ backgroundColor: colors.primaryLight }}>
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <Ionicons name="clipboard-outline" size={17} color={colors.primaryDark} />
              <Text className="font-bold text-sm" style={{ color: colors.primaryDark }}>
                Review
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text className="text-ink text-sm">
                <Text className="font-semibold">Format: </Text>
                {tournamentFormat
                  ? `${FORMAT_OPTIONS.find((f) => f.value === tournamentFormat)?.label} — ${FORMAT_TAGLINE[tournamentFormat]}`
                  : "Not selected yet"}
              </Text>
              <Text className="text-ink text-sm">
                <Text className="font-semibold">Teams: </Text>
                {numberOfTeams ? `${numberOfTeams} teams` : "Not set yet"}
              </Text>
              <Text className="text-ink text-sm">
                <Text className="font-semibold">Matches: </Text>
                {!tournamentFormat || !numberOfTeams
                  ? "Set the format and team count to estimate this"
                  : tournamentFormat === "KNOCKOUT"
                    ? `${numberOfTeams - 1} matches to crown a champion`
                    : tournamentFormat === "LEAGUE"
                      ? `${(numberOfTeams * (numberOfTeams - 1)) / 2} matches — every team plays every other team once`
                      : tournamentFormat === "MANUAL"
                        ? "Added by you, stage by stage, once teams are approved"
                        : numberOfGroups
                        ? (() => {
                            const sizes = distributeTeamsIntoGroups(numberOfTeams, numberOfGroups);
                            const groupMatches = sizes.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
                            const qualifiers = numberOfGroups * (qualifiersPerGroup ?? 1);
                            const knockoutMatches = qualifiers > 1 ? qualifiers - 1 : 0;
                            return `${groupMatches} group matches + ${knockoutMatches} knockout matches (${qualifiers} teams qualify)`;
                          })()
                        : "Set the number of groups to estimate this"}
              </Text>
              {tournamentFormat === "KNOCKOUT" && numberOfTeams != null && knockoutByeCount(numberOfTeams) > 0 && (
                <Text className="text-ink text-sm">
                  <Text className="font-semibold">Byes: </Text>
                  {knockoutByeCount(numberOfTeams)} team(s) advance automatically in round 1
                </Text>
              )}
              {tournamentFormat === "LEAGUE" && numberOfTeams != null && (
                <Text className="text-ink text-sm">
                  <Text className="font-semibold">Rounds: </Text>
                  {leagueRoundsAndMatchesPerTeam(numberOfTeams).rounds} rounds,{" "}
                  {leagueRoundsAndMatchesPerTeam(numberOfTeams).matchesPerTeam} matches per team
                </Text>
              )}
              <Text className="text-ink text-sm">
                <Text className="font-semibold">Venue: </Text>
                {customVenueName || venues?.find((v) => v.id === venueId)?.name || "Not selected yet"}
              </Text>
              <Text className="text-ink text-sm">
                <Text className="font-semibold">Schedule: </Text>
                {formatDateIso(selectedDate)}
                {durationDays > 1 ? ` – ${formatDateIso(addDays(selectedDate, durationDays - 1))}` : ""}
                {startTime ? ` · starts ${TIME_SLOTS.find((t) => t.value === startTime)?.label ?? startTime}` : ""}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleCreate}
          disabled={createGame.isPending}
          className="mt-6"
          style={{
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <GradientFill className="flex-row items-center justify-center rounded-2xl py-4" style={{ gap: 8 }}>
            {createGame.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="trophy" size={18} color="white" />
                <Text className="text-jazba-white font-bold text-base">
                  {isTournament ? "Post Tournament" : "Post Game"}
                </Text>
              </>
            )}
          </GradientFill>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
