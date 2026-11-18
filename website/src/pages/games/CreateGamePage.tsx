import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useSports } from "@app/hooks/useSports";
import { useVenues } from "@app/hooks/useVenues";
import { useCreateGame } from "@app/hooks/useGames";
import { isCricketFamily } from "@app/lib/api/sports";
import { createTournamentTeamPlaceholders } from "@app/lib/api/tournamentTeams";
import { createPools } from "@app/lib/api/tournamentPools";
import { generateMatches, generatePoolMatches } from "@app/lib/api/tournamentMatches";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import type { Database } from "@app/types/database.types";
import { reverseGeocodeViaNominatim } from "@app/lib/locationPicker";
import { saveGeneratedVisualAsset } from "@app/services/assets/assetGenerator";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";
import { getSportImage } from "@app/lib/sportImages";
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
} from "@app/lib/gameFormHelpers";
import { computeKnockoutFixtures, distributeTeamsIntoGroups, leagueRoundsAndMatchesPerTeam } from "@app/lib/tournamentFixtures";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { pickImages, uploadImage } from "@app/lib/upload";
import { supabase } from "@app/lib/supabase";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import FieldInput from "@/components/ui/FieldInput";
import { PillRow, SectionLabel } from "@/components/forms/FormControls";
import VenueSearchField from "@/components/forms/VenueSearchField";
import LocationMapPicker from "@/components/maps/LocationMapPicker";
import { HomeSportTile } from "@/components/home/HomeCards";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type SkillLevel = Database["public"]["Enums"]["game_skill_level_type"];
type Gender = Database["public"]["Enums"]["game_gender_type"];
type GameType = Database["public"]["Enums"]["game_type_type"];
type TournamentFormat = Database["public"]["Enums"]["tournament_format_type"];

const HOURS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const isValidGroupCount = (n: number, totalTeams: number) => n >= 2 && n <= totalTeams;
const recommendGroupCount = (totalTeams: number) => Math.min(4, Math.max(2, Math.round(totalTeams / 3)));
const knockoutByeCount = (n: number) => computeKnockoutFixtures(Array.from({ length: n }, (_, i) => String(i))).filter((f) => f.teamB === null).length;
function formatDateIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}
function indexToLetters(i: number) {
  let n = i;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const FORMAT_OPTIONS: { value: TournamentFormat; label: string; icon: string }[] = [
  { value: "KNOCKOUT", label: "Knockout", icon: "trophy" },
  { value: "LEAGUE", label: "League", icon: "grid-outline" },
  { value: "POOL", label: "Groups + Knockout", icon: "people" },
  { value: "MANUAL", label: "Manual", icon: "construct-outline" },
];
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

// Tournament "Duration" cells: 1-6 days, then week/month markers (still the
// plain day count underneath: 1 week = 7, 1 month = 30).
const TOURNAMENT_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 30] as const;
function tournamentDurationLabel(days: number): string {
  if (days === 7) return "1 week";
  if (days === 14) return "2 weeks";
  if (days === 21) return "3 weeks";
  if (days === 30) return "1 month";
  return `${days} day`;
}

// A horizontally scrolling (wrapping on desktop) chip row.
function Chips({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{children}</div>;
}

function Chip({ selected, onPress, children, className = "px-4 py-2.5" }: { selected: boolean; onPress: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={`shrink-0 rounded-2xl border-[1.5px] text-sm font-medium transition active:scale-95 ${className} ${
        selected ? "border-primary bg-brand text-white shadow-cta" : "border-border bg-surface text-ink hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-2xl bg-primary-light px-3.5 py-3 text-xs text-primary-dark">
      <Ionicon name="information-circle" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
      <span className="flex-1">{text}</span>
    </p>
  );
}

type StepKey = "details" | "format" | "teams" | "review";
const STEPS: { key: StepKey; n: number; label: string }[] = [
  { key: "details", n: 1, label: "Details" },
  { key: "format", n: 2, label: "Format" },
  { key: "teams", n: 3, label: "Teams" },
  { key: "review", n: 4, label: "Review" },
];

// Port of CreateGameScreen ("Host a Game" / "Create Tournament"): custom
// icon, title, sport, type, venue (app venues or a map pick), date, time,
// duration; tournaments add format, team/group counts and a review; then
// skill, open-to, fee, description. Posting creates the game, team
// placeholders, pools and fixtures exactly like the app.
export default function CreateGamePage() {
  const [params] = useSearchParams();
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.games());
  const userId = useAuthStore((s) => s.session?.user.id);
  const myGender = useProfileStore((s) => s.profile?.gender);
  const createGame = useCreateGame();
  const { data: sports } = useSports();
  const forcedTournament = params.get("type") === "TOURNAMENT";

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<{ uri: string; mimeType?: string; fileName?: string; file?: File } | null>(null);
  // No Game Type field any more: fixed by the route the host came through
  // (Host Game vs Host Tournament).
  const gameType: GameType = forcedTournament ? "TOURNAMENT" : "REGULAR";
  const [sportId, setSportId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [customVenueName, setCustomVenueName] = useState<string | null>(null);
  const { data: venues, isLoading: venuesLoading } = useVenues({ sportId: sportId ?? undefined });
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [customVenueLat, setCustomVenueLat] = useState<number | null>(null);
  const [customVenueLng, setCustomVenueLng] = useState<number | null>(null);
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  // Sticky once a pin is confirmed, so clearing the (optional) address text
  // doesn't make the field itself disappear.
  const [addressFieldVisible, setAddressFieldVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(DAYS[0].iso);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(1);
  const [hoursPerDay, setHoursPerDay] = useState<number>(1);
  const [numberOfTeams, setNumberOfTeams] = useState<number | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState<number | null>(null);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [numberOfGroups, setNumberOfGroups] = useState<number | null>(null);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState<number | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [gender, setGender] = useState<Gender>("mixed");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("0");

  // Step tracker follows the scroll position (tournaments only).
  const sectionRefs = useRef<Record<StepKey, HTMLDivElement | null>>({ details: null, format: null, teams: null, review: null });
  const [activeStep, setActiveStep] = useState(1);
  const isTournament = gameType === "TOURNAMENT";
  useEffect(() => {
    if (!isTournament) return;
    const onScroll = () => {
      const y = 200;
      let step = 1;
      for (const s of STEPS) {
        const el = sectionRefs.current[s.key];
        if (el && el.getBoundingClientRect().top <= y) step = s.n;
      }
      setActiveStep(step);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isTournament]);
  const scrollToStep = (key: StepKey) => {
    const el = sectionRefs.current[key];
    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 150, behavior: "smooth" });
  };
  const mark = (key: StepKey) => (el: HTMLDivElement | null) => {
    sectionRefs.current[key] = el;
  };

  const handleSportChange = (id: string) => {
    setSportId(id);
    setVenueId(null);
    setCustomVenueName(null);
    setAddressFieldVisible(false);
    setManualLocationMode(false);
    setCustomVenueLat(null);
    setCustomVenueLng(null);
  };

  const toggleManualLocation = () => {
    if (manualLocationMode) {
      setManualLocationMode(false);
      setCustomVenueName(null);
      setAddressFieldVisible(false);
      setCustomVenueLat(null);
      setCustomVenueLng(null);
      return;
    }
    setVenueId(null);
    setCustomVenueName(null);
    setAddressFieldVisible(false);
    // The map picker centers itself on the device's location.
    setManualLocationMode(true);
  };

  const confirmMapLocation = async (lat: number, lng: number) => {
    setConfirmingLocation(true);
    try {
      setCustomVenueName(await reverseGeocodeViaNominatim(lat, lng));
      setAddressFieldVisible(true);
      setCustomVenueLat(lat);
      setCustomVenueLng(lng);
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not look up an address for this location."));
    } finally {
      setConfirmingLocation(false);
    }
  };

  const resizeTeamNames = (total: number | null) => setTeamNames(total ? Array.from({ length: total }, (_, i) => `Team ${indexToLetters(i)}`) : []);
  const handleNumberOfTeams = (n: number) => {
    setNumberOfTeams(n);
    resizeTeamNames(n);
    if (tournamentFormat === "POOL") {
      const r = recommendGroupCount(n);
      setNumberOfGroups(r);
      setGroupNames(Array.from({ length: r }, (_, i) => `Group ${i + 1}`));
    }
  };
  const handleNumberOfGroups = (n: number) => {
    setNumberOfGroups(n);
    setGroupNames(Array.from({ length: n }, (_, i) => `Group ${i + 1}`));
  };
  const handleFormat = (format: TournamentFormat) => {
    setTournamentFormat(format);
    setNumberOfGroups(null);
    setGroupNames([]);
    setQualifiersPerGroup(null);
    if (numberOfTeams !== null && (numberOfTeams < 2 || (format === "POOL" && numberOfTeams < 4))) {
      setNumberOfTeams(null);
      setTeamNames([]);
    }
  };

  const sportName = sports?.find((s) => s.id === sportId)?.name ?? null;
  const genderOptions: { label: string; value: Gender }[] =
    myGender === "male"
      ? [{ label: "Everyone", value: "mixed" }, { label: "Male Only", value: "male" }]
      : myGender === "female"
        ? [{ label: "Everyone", value: "mixed" }, { label: "Female Only", value: "female" }]
        : [{ label: "Everyone", value: "mixed" }];
  const isCricket = isCricketFamily(sportName);
  const isFootball = (sportName ?? "").toLowerCase().includes("football");
  const playersPerTeamOptions = isCricket ? PLAYERS_PER_TEAM_OPTIONS.filter((n) => n !== 1) : !isFootball && sportName ? PLAYERS_PER_TEAM_OPTIONS.slice(0, 2) : PLAYERS_PER_TEAM_OPTIONS;
  const noun = isTournament ? "tournament" : "game";

  const handleCreate = async () => {
    if (!userId) return;
    if (!isValidName(title)) return Alert.alert("Invalid Title", `${isTournament ? "Tournament" : "Game"} title must be ${NAME_REQUIREMENT_HINT}.`);
    if (!sportId) return Alert.alert("Missing Info", "Please select a sport.");
    if (!venueId && !customVenueName) return Alert.alert("Missing Info", "Please select or enter a venue.");
    if (!startTime) return Alert.alert("Missing Info", "Please select a start time.");
    if (selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, startTime)) return Alert.alert("Invalid Start Time", "That time has already passed. Please pick a later start time.");
    if (!skillLevel) return Alert.alert("Missing Info", "Please select a skill level.");
    if (isTournament && !tournamentFormat) return Alert.alert("Missing Info", "Please select a tournament format (Knockout, League, Pool, or Manual).");
    if (isTournament && tournamentFormat === "POOL" && (!numberOfGroups || !qualifiersPerGroup))
      return Alert.alert("Missing Info", "Please select a number of groups and how many teams qualify from each.");
    const teams = numberOfTeams ?? 0;
    const perTeam = playersPerTeam ?? 0;
    if (isTournament && (teams < 2 || perTeam < 1)) return Alert.alert("Missing Info", "Please select a number of teams and players per team.");
    if (!isTournament && perTeam < 1) return Alert.alert("Missing Info", "Please select players per team.");

    const trimmedGroupNames = groupNames.map((n) => n.trim());
    if (tournamentFormat === "POOL") {
      if (!isValidGroupCount(numberOfGroups ?? 0, teams)) return Alert.alert("Invalid Group Count", "Please choose a number of groups no larger than the team count.");
      if (trimmedGroupNames.some((n) => !n)) return Alert.alert("Missing Info", "Please enter a name for every group.");
      if (new Set(trimmedGroupNames.map((n) => n.toLowerCase())).size !== trimmedGroupNames.length) return Alert.alert("Duplicate Group Names", "Group names must be unique.");
    }

    const regularEnd = isTournament ? null : addMinutesWithOverflow(startTime, Math.round(duration * 60));
    const singleDayEnd = isTournament && durationDays === 1 ? addMinutesWithOverflow(startTime, hoursPerDay * 60) : null;
    const endDateValue = isTournament
      ? durationDays === 1
        ? singleDayEnd!.daysOverflow > 0
          ? addDays(selectedDate, singleDayEnd!.daysOverflow)
          : null
        : addDays(selectedDate, durationDays - 1)
      : regularEnd!.daysOverflow > 0
        ? addDays(selectedDate, regularEnd!.daysOverflow)
        : null;
    const endTimeValue = isTournament ? (durationDays === 1 ? `${singleDayEnd!.time}:00` : "23:59:59") : `${regularEnd!.time}:00`;
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
        maxPlayers: isTournament ? teams * perTeam : perTeam * 2,
        skillLevel,
        visibility: "public",
        gender,
        description: description.trim(),
        entryFee: parseInt(entryFee, 10) || 0,
        gameType,
        numberOfTeams: isTournament ? teams : 2,
        playersPerTeam: perTeam,
        tournamentFormat: isTournament ? tournamentFormat : null,
        dailyHours: isTournament ? hoursPerDay : null,
        poolQualifiersPerGroup: isTournament && tournamentFormat === "POOL" ? qualifiersPerGroup : null,
      });
      // Open the detail page as soon as the core row exists: teams, matches
      // and the icon finish in the background while it fills in live.
      navigate(paths.game(game.id), { replace: true });
      navigatedAway = true;
      if (isTournament) {
        if (tournamentFormat === "POOL") {
          const pools = await createPools(game.id, trimmedGroupNames);
          const sizes = distributeTeamsIntoGroups(teams, pools.length);
          const poolIds: string[] = [];
          pools.forEach((pool, gi) => {
            for (let k = 0; k < sizes[gi]; k++) poolIds.push(pool.id);
          });
          const created = await createTournamentTeamPlaceholders(game.id, teamNames, poolIds);
          await generatePoolMatches(
            game.id,
            pools.map((pool) => ({ poolId: pool.id, teams: created.filter((t) => t.pool_id === pool.id).map((t) => ({ id: t.id, name: t.name })) }))
          );
        } else if (tournamentFormat === "MANUAL") {
          // No auto pairing: the host adds every match from the Matches panel.
          await createTournamentTeamPlaceholders(game.id, teamNames);
        } else {
          const created = await createTournamentTeamPlaceholders(game.id, teamNames);
          await generateMatches(game.id, tournamentFormat!, created.map((t) => ({ id: t.id, name: t.name })));
        }
      } else {
        await createTournamentTeamPlaceholders(game.id, ["Team A", "Team B"]);
      }
      if (icon) {
        const { publicUrl } = await uploadImage(icon, { bucket: "game-icons", pathPrefix: game.id });
        await supabase.from("games").update({ icon_url: publicUrl }).eq("id", game.id);
      } else {
        try {
          const publicUrl = await saveGeneratedVisualAsset(
            { id: game.id, name: game.title, sport: sportName, kind: isTournament ? "tournament" : "game" },
            { bucket: "game-icons", folder: game.id }
          );
          const { error: iconUpdateError } = await supabase.from("games").update({ icon_url: publicUrl }).eq("id", game.id);
          if (iconUpdateError) throw iconUpdateError;
        } catch {
          // The same deterministic local badge still renders without it.
        }
      }
    } catch (err) {
      Alert.alert(
        "Error",
        navigatedAway
          ? getFriendlyErrorMessage(err, `The ${noun} was created, but finishing setup (teams/matches${icon ? "/icon" : ""}) failed. You can keep going from its detail page.`)
          : getFriendlyErrorMessage(err, `Could not create ${noun}. Please try again.`)
      );
    }
  };

  const groupSplit = numberOfTeams != null && numberOfGroups ? distributeTeamsIntoGroups(numberOfTeams, numberOfGroups) : null;
  const league = numberOfTeams != null ? leagueRoundsAndMatchesPerTeam(numberOfTeams) : null;
  const byes = numberOfTeams != null ? knockoutByeCount(numberOfTeams) : 0;
  const countChips = (options: readonly number[], value: number | null, onChange: (n: number) => void) => (
    <Chips>
      {options.map((n) => (
        <Chip key={n} selected={value === n} onPress={() => onChange(n)} className="w-12 py-2.5">
          {n}
        </Chip>
      ))}
    </Chips>
  );

  return (
    <div className="mx-auto max-w-3xl lg:px-8">
      <div className="sticky top-[var(--header-h)] z-30 border-b border-border bg-white/95 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur lg:pt-6">
        <div className="flex items-center px-4 pb-4 lg:px-0">
          <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 transition hover:bg-gray-100 active:scale-90">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-ink">{isTournament ? "Create Tournament" : "Host a Game"}</h1>
            <p className="mt-0.5 text-xs text-muted">{isTournament ? "Bring players together and compete" : "Invite players to your game"}</p>
          </div>
          <button type="button" onClick={handleCreate} disabled={createGame.isPending} className="press flex min-w-16 items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-cta">
            {createGame.isPending ? <Spinner size={16} color="white" /> : "Post"}
          </button>
        </div>
        {isTournament && (
          <div className="flex gap-1 px-4 pb-3 lg:px-0">
            {STEPS.map((s) => {
              const done = activeStep > s.n;
              const current = activeStep === s.n;
              return (
                <button key={s.key} type="button" onClick={() => scrollToStep(s.key)} className="flex flex-1 flex-col items-center">
                  <span className="flex items-center gap-[5px]">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${done || current ? "bg-brand text-white" : "bg-border text-muted"}`}>
                      {done ? <Ionicon name="checkmark" size={12} color="white" /> : s.n}
                    </span>
                    <span className={`truncate text-xs ${current ? "font-bold text-ink" : done ? "text-ink" : "text-muted"}`}>{s.label}</span>
                  </span>
                  <span className={`mt-1.5 h-[3px] w-full rounded-sm ${current ? "bg-brand" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form className="px-3.5 pb-16 lg:px-0" onSubmit={(e) => (e.preventDefault(), handleCreate())}>
        <div ref={mark("details")} />
        <button
          type="button"
          onClick={async () => {
            const assets = await pickImages({});
            if (assets[0]) setIcon(assets[0]);
          }}
          className="press relative mb-1 mt-3 flex min-h-28 w-full items-center overflow-hidden rounded-2xl bg-brand text-left shadow-card"
        >
          <Ionicon name="ribbon" size={90} color="white" style={{ position: "absolute", right: -6, top: 4, opacity: 0.15, transform: "rotate(18deg)" }} />
          <Ionicon name="trophy" size={54} color="#F5B400" style={{ position: "absolute", right: 34, top: 18, transform: "rotate(-6deg)" }} />
          <Ionicon name="sparkles" size={14} color="white" style={{ position: "absolute", right: 108, top: 14, opacity: 0.6 }} />
          <Ionicon name="sparkles" size={10} color="white" style={{ position: "absolute", right: 90, top: 50, opacity: 0.5 }} />
          <span className="flex flex-1 items-center gap-3 px-4 py-4">
            <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-dashed border-white/60">
              {icon ? (
                <img src={icon.uri} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <GeneratedEntityVisual
                  id={title.trim() || `${noun}-${sportName ?? "sport"}`}
                  name={title.trim() || (isTournament ? "Your Tournament" : "Your Game")}
                  sport={sportName}
                  kind={isTournament ? "tournament" : "game"}
                  size={44}
                  style={{ borderRadius: 22 }}
                />
              )}
              <span className="absolute bottom-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[#07301D] bg-brand">
                <Ionicon name="add" size={11} color="white" />
              </span>
            </span>
            <span className="max-w-[62%]">
              <span className="flex flex-wrap items-center gap-1">
                <span className="text-base font-bold text-white">{icon ? "Change icon" : "Upload custom icon"}</span>
                <span className="text-xs text-white/65">(optional)</span>
              </span>
              <span className="mt-1 block text-xs text-white/65">A generated {isTournament ? "tournament emblem" : "game badge"} is included. You can upload your own.</span>
            </span>
          </span>
        </button>

        <SectionLabel title={isTournament ? "Tournament Title" : "Game Title"} required icon="pencil-outline" compact />
        <FieldInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Saturday morning football"
          maxLength={80}
          right={
            title ? (
              <button type="button" aria-label="Clear title" onClick={() => setTitle("")}>
                <Ionicon name="close" size={18} color={colors.muted} />
              </button>
            ) : undefined
          }
        />

        <SectionLabel title="Sport" required icon="trophy-outline" compact />
        <div className="no-scrollbar -mx-3.5 flex gap-3 overflow-x-auto px-3.5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {(sports ?? []).map((s) => (
            <HomeSportTile key={s.id} name={s.name} selected={sportId === s.id} onPress={() => handleSportChange(s.id)} />
          ))}
        </div>

        <SectionLabel title="Venue" required icon="location-outline" compact />
        <button type="button" onClick={toggleManualLocation} className="mb-2 flex items-center gap-1.5 rounded-full border border-primary bg-primary-light px-3.5 py-2 text-sm font-semibold text-primary-dark hover:brightness-95">
          <Ionicon name={manualLocationMode ? "list-outline" : "map-outline"} size={15} color={colors.primaryDark} />
          {manualLocationMode ? "Choose from app venues instead" : "Enter Location Manually"}
        </button>
        {manualLocationMode ? (
          <>
            <LocationMapPicker onConfirm={confirmMapLocation} confirming={confirmingLocation} selectedLabel={customVenueName} />
            {addressFieldVisible && (
              <div className="mt-3">
                <p className="mb-1.5 text-sm font-semibold text-ink">
                  Address <span className="font-normal text-muted">(optional — edit if this isn't exact)</span>
                </p>
                <textarea
                  value={customVenueName ?? ""}
                  onChange={(e) => setCustomVenueName(e.target.value)}
                  placeholder="Enter the exact address"
                  rows={2}
                  className="w-full resize-none rounded-2xl border-[1.5px] border-border px-4 py-3 text-ink outline-none focus:border-primary focus:bg-primary-light"
                />
              </div>
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
              thumbnail={sportName ? imageUrl(getSportImage(sportName)) : null}
            />
            {venueId && (
              <button type="button" onClick={() => navigate(paths.venue(venueId))} className="mt-2 flex w-full items-center justify-between px-1 py-1 text-sm font-medium text-primary hover:underline">
                View venue details
                <Ionicon name="chevron-forward" size={15} color={colors.primary} />
              </button>
            )}
          </>
        )}

        <SectionLabel title="Date" required icon="calendar-outline" compact />
        <Chips>
          {DAYS.filter((d) => TIME_SLOTS.some((t) => !isTimeSlotPast(d.iso, t.value))).map((d) => (
            <Chip
              key={d.iso}
              selected={selectedDate === d.iso}
              className="flex flex-col items-center px-3 py-2.5"
              onPress={() => {
                setSelectedDate(d.iso);
                if (startTime && d.iso === DAYS[0].iso && isTimeSlotPast(d.iso, startTime)) setStartTime(null);
              }}
            >
              <span className={`block text-xs ${selectedDate === d.iso ? "text-white" : "text-muted"}`}>{d.day}</span>
              <span className="mt-0.5 block text-base font-bold">{d.label}</span>
            </Chip>
          ))}
        </Chips>

        {isTournament && (
          <>
            <SectionLabel title="Duration" icon="timer-outline" compact />
            <Chips>
              {TOURNAMENT_DURATION_OPTIONS.map((d) => (
                <Chip key={d} selected={durationDays === d} onPress={() => setDurationDays(d)}>
                  {tournamentDurationLabel(d)}
                </Chip>
              ))}
            </Chips>
          </>
        )}

        <SectionLabel title={isTournament ? "Start Time (Each Day)" : "Start Time"} required icon="time-outline" compact />
        <Chips>
          {TIME_SLOTS.filter((t) => !(selectedDate === DAYS[0].iso && isTimeSlotPast(selectedDate, t.value))).map((t) => (
            <Chip key={t.value} selected={startTime === t.value} onPress={() => setStartTime(t.value)} className="px-3 py-2.5">
              {t.label}
            </Chip>
          ))}
        </Chips>

        <SectionLabel title={isTournament ? "Hours (Each Day)" : "Duration"} icon={isTournament ? "hourglass-outline" : "timer-outline"} compact />
        <Chips>
          {(isTournament ? HOURS_PER_DAY_OPTIONS : DURATIONS).map((h) => (
            <Chip key={h} selected={(isTournament ? hoursPerDay : duration) === h} onPress={() => (isTournament ? setHoursPerDay(h) : setDuration(h))}>
              {h === 1 ? "1 hr" : `${h} hrs`}
            </Chip>
          ))}
        </Chips>

        {isTournament ? (
          <>
            <div ref={mark("format")} />
            <SectionLabel title="Tournament Format" required icon="git-branch-outline" compact />
            <div className="flex flex-col gap-2.5">
              {FORMAT_OPTIONS.map((f) => {
                const selected = tournamentFormat === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleFormat(f.value)}
                    className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition ${selected ? "border-primary bg-primary-light" : "border-border bg-surface hover:border-primary/40"}`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-surface" : "bg-gray-100"}`}>
                      <Ionicon name={f.icon} size={19} color={selected ? colors.primaryDark : colors.muted} />
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm font-bold ${selected ? "text-primary-dark" : "text-ink"}`}>{f.label}</span>
                      <span className={`mt-0.5 block text-xs ${selected ? "text-primary-dark" : "text-muted"}`}>{FORMAT_TAGLINE[f.value]}</span>
                    </span>
                    {selected && (
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand">
                        <Ionicon name="checkmark" size={14} color="white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {tournamentFormat && <InfoBox text={FORMAT_INFO[tournamentFormat]} />}

            {tournamentFormat === "POOL" ? (
              <>
                <SectionLabel title="Total Number of Teams" required icon="people-outline" compact />
                {countChips(NUMBER_OF_TEAMS_OPTIONS.filter((n) => n >= 4), numberOfTeams, handleNumberOfTeams)}
                <SectionLabel title="Number of Groups" required icon="layers-outline" compact />
                {countChips(NUMBER_OF_GROUPS_OPTIONS.filter((n) => isValidGroupCount(n, numberOfTeams ?? 0)), numberOfGroups, handleNumberOfGroups)}
                <InfoBox
                  text={
                    numberOfTeams != null && numberOfGroups != null && numberOfGroups > 0
                      ? `Suggested split: ${distributeTeamsIntoGroups(numberOfTeams, numberOfGroups).join(" + ")} teams across ${numberOfGroups} groups.`
                      : "Pick a team count to see a suggested group split."
                  }
                />
                <SectionLabel title="Teams Qualifying per Group" required icon="trophy-outline" compact />
                {countChips([1, 2], qualifiersPerGroup, setQualifiersPerGroup)}
                <InfoBox text="The top team(s) from each group advance to a knockout stage." />
                <SectionLabel title="Players per Team" required icon="person-outline" compact />
                {countChips(playersPerTeamOptions, playersPerTeam, setPlayersPerTeam)}
              </>
            ) : (
              <>
                <SectionLabel title="Number of Teams" required icon="people-outline" compact />
                {countChips(NUMBER_OF_TEAMS_OPTIONS.filter((n) => n >= 2), numberOfTeams, handleNumberOfTeams)}
                {tournamentFormat === "KNOCKOUT" && numberOfTeams != null && (
                  <InfoBox
                    text={
                      byes > 0
                        ? `${byes} team(s) get a bye in round 1 — every team still plays ${numberOfTeams - 1 > 0 ? "its way to a single champion" : "on"} across ${numberOfTeams - 1} total matches.`
                        : `No byes needed — ${numberOfTeams - 1} total matches to crown a champion.`
                    }
                  />
                )}
                {tournamentFormat === "LEAGUE" && league && <InfoBox text={`${league.matchesPerTeam} matches per team across ${league.rounds} rounds.`} />}
                <SectionLabel title="Players per Team" required icon="person-outline" compact />
                {countChips(playersPerTeamOptions, playersPerTeam, setPlayersPerTeam)}
              </>
            )}

            <div ref={mark("teams")} />
            <InfoBox text="Anyone can join an open team slot — a team joins the tournament automatically once it's full." />
          </>
        ) : (
          <>
            <SectionLabel title="Players per Team" required icon="person-outline" compact />
            {countChips(playersPerTeamOptions, playersPerTeam, setPlayersPerTeam)}
            <InfoBox text="Regular games default to 2 teams (Team A and Team B) — this sets how many players join each side." />
          </>
        )}

        {isTournament && <div ref={mark("review")} />}

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

        <SectionLabel title="Open To" icon="people-outline" compact />
        <PillRow<Gender> options={genderOptions} value={gender} onChange={setGender} />

        <p className="mb-2 mt-3 flex items-center text-sm font-semibold text-ink">
          <MCIcon name="cash-multiple" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          {isTournament ? "Entry Fee per Team (Rs)" : "Entry Fee per Person (Rs)"}
        </p>
        <FieldInput
          value={entryFee}
          onChange={(e) => setEntryFee(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="0"
          left={<span className="mr-2 text-muted">Rs</span>}
          right={
            entryFee !== "0" && entryFee ? (
              <button type="button" aria-label="Reset fee" onClick={() => setEntryFee("0")}>
                <Ionicon name="close" size={18} color={colors.muted} />
              </button>
            ) : undefined
          }
        />
        <p className="mt-1 text-xs text-muted">{isTournament ? "Enter 0 for a free tournament" : "Enter 0 for a free game"}</p>

        <SectionLabel title="Description" icon="document-text-outline" compact />
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Add any additional details (meeting point, rules, prizes, etc.)"
            maxLength={500}
            rows={3}
            className="h-[88px] w-full resize-none rounded-2xl border-[1.5px] border-border px-4 pb-5 pt-3 text-ink outline-none placeholder:text-muted focus:border-primary focus:bg-primary-light"
          />
          <span className="absolute bottom-2 right-3 text-xs text-muted">{description.length}/500</span>
        </div>
        <p className="mt-1 text-xs text-muted">Add any additional details (meeting point, rules, prizes, etc.).</p>

        {isTournament && (
          <div className="mt-6 rounded-2xl bg-primary-light p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary-dark">
              <Ionicon name="clipboard-outline" size={17} color={colors.primaryDark} />
              Review
            </p>
            <div className="flex flex-col gap-1.5 text-sm text-ink">
              <p>
                <b className="font-semibold">Format: </b>
                {tournamentFormat ? `${FORMAT_OPTIONS.find((f) => f.value === tournamentFormat)?.label} — ${FORMAT_TAGLINE[tournamentFormat]}` : "Not selected yet"}
              </p>
              <p>
                <b className="font-semibold">Teams: </b>
                {numberOfTeams ? `${numberOfTeams} teams` : "Not set yet"}
              </p>
              <p>
                <b className="font-semibold">Matches: </b>
                {!tournamentFormat || !numberOfTeams
                  ? "Set the format and team count to estimate this"
                  : tournamentFormat === "KNOCKOUT"
                    ? `${numberOfTeams - 1} matches to crown a champion`
                    : tournamentFormat === "LEAGUE"
                      ? `${(numberOfTeams * (numberOfTeams - 1)) / 2} matches — every team plays every other team once`
                      : tournamentFormat === "MANUAL"
                        ? "Added by you, stage by stage, once teams are approved"
                        : groupSplit && numberOfGroups
                        ? (() => {
                            const groupMatches = groupSplit.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
                            const qualifiers = numberOfGroups * (qualifiersPerGroup ?? 1);
                            return `${groupMatches} group matches + ${qualifiers > 1 ? qualifiers - 1 : 0} knockout matches (${qualifiers} teams qualify)`;
                          })()
                        : "Set the number of groups to estimate this"}
              </p>
              {tournamentFormat === "KNOCKOUT" && numberOfTeams != null && byes > 0 && (
                <p>
                  <b className="font-semibold">Byes: </b>
                  {byes} team(s) advance automatically in round 1
                </p>
              )}
              {tournamentFormat === "LEAGUE" && league && (
                <p>
                  <b className="font-semibold">Rounds: </b>
                  {league.rounds} rounds, {league.matchesPerTeam} matches per team
                </p>
              )}
              <p>
                <b className="font-semibold">Venue: </b>
                {customVenueName || venues?.find((v) => v.id === venueId)?.name || "Not selected yet"}
              </p>
              <p>
                <b className="font-semibold">Schedule: </b>
                {formatDateIso(selectedDate)}
                {durationDays > 1 ? ` – ${formatDateIso(addDays(selectedDate, durationDays - 1))}` : ""}
                {startTime ? ` · starts ${TIME_SLOTS.find((t) => t.value === startTime)?.label ?? startTime}` : ""}
              </p>
            </div>
          </div>
        )}

        <button type="submit" disabled={createGame.isPending} className="press mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-base font-bold text-white shadow-cta">
          {createGame.isPending ? (
            <Spinner color="white" />
          ) : (
            <>
              <Ionicon name="trophy" size={18} color="white" />
              {isTournament ? "Post Tournament" : "Post Game"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
