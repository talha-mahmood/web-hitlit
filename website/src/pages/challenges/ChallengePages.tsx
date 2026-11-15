import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useSquads, useTeamChallenges, useTeamFixtures, useTeamFixture, useRespondToTeamChallenge, useCancelTeamChallenge } from "@app/hooks/useSquads";
import { useMyOwnedSquads, useMySquads } from "@app/hooks/useSquadTeamFill";
import { useSports } from "@app/hooks/useSports";
import { useDeviceLocation } from "@app/hooks/useDeviceLocation";
import { useAuthStore } from "@app/store/authStore";
import { distanceKm, formatDistanceKm } from "@app/lib/distance";
import { challengeFormatsForSport } from "@app/lib/teamChallengeFormats";
import { linkTeamFixtureScorecard, type TeamChallenge, type TeamFixturePrefill } from "@app/lib/api/teamChallenges";
import type { SquadListItem } from "@app/lib/api/squads";
import { fetchMatchesForTournament, type ScorecardPrefill } from "@app/lib/api/tournamentMatches";
import { fetchTeamsForTournament } from "@app/lib/api/tournamentTeams";
import { disambiguateRoster } from "@app/lib/matchNameValidation";
import { isCricketFamily } from "@app/lib/api/sports";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import PlainHeader from "@/components/ui/PlainHeader";
import GeneratedEntityVisual from "@/components/GeneratedEntityVisual";
import { SelectCitySheet, SelectSportSheet } from "@/components/filters/FilterSheets";
import { TeamChallengeComposerModal, TeamManagerRequiredModal } from "@/components/challenges/ChallengeModals";
import { useAppNavigate } from "@/routes/navigation";
import { paths, type MatchSport } from "@/routes/paths";

const KARACHI = "Asia/Karachi";
const formatDate = (v: string) => new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: KARACHI }).format(new Date(v));
const formatTime = (v: string) => new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: KARACHI }).format(new Date(v));
const dateTime = (v: string) => new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: KARACHI }).format(new Date(v));

const isChallengeTeam = (t: { group_type: string; sports?: { name: string } | null }) => t.group_type === "team" && challengeFormatsForSport(t.sports?.name).length > 0;

function matchSportFor(sportName: string): MatchSport {
  const s = sportName.toLowerCase();
  if (s === "football") return "football";
  if (["hard ball", "tape ball", "outdoor cricket", "cricket"].includes(s)) return "cricket";
  if (s === "padel" || s === "tennis" || s === "badminton" || s === "pickleball") return s;
  return "table_tennis";
}
const SPORT_BY_TABLE: Record<string, MatchSport> = {
  football_matches: "football",
  cricket_matches: "cricket",
  padel_matches: "padel",
  tennis_matches: "tennis",
  badminton_matches: "badminton",
  pickleball_matches: "pickleball",
  table_tennis_matches: "table_tennis",
};

function FilterChip({ icon, label, active, onPress, bold }: { icon: string; label: string; active?: boolean; onPress: () => void; bold?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${bold ? "font-bold" : "font-medium"} ${active ? "border-primary bg-primary-light text-primary" : "border-border bg-surface-raised text-muted hover:border-primary/40"}`}
    >
      <Ionicon name={icon} size={15} color={active ? colors.primary : colors.muted} />
      <span className="max-w-[140px] truncate">{label}</span>
    </button>
  );
}

function TeamRowSkeleton() {
  return (
    <div className="mb-1.5 flex min-h-14 items-center rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-card">
      <SkeletonBlock width={36} height={36} radius={9} />
      <div className="ml-2 mr-1.5 flex flex-1 flex-col gap-1.5">
        <SkeletonBlock width="55%" height={13} />
        <SkeletonBlock width="70%" height={11} />
      </div>
      <SkeletonBlock width={70} height={32} radius={8} />
    </div>
  );
}

// Port of ChallengeTeamsScreen: every challengeable team (not yours, not one
// you're in), filtered by search (name or team ID), sport, near me or city;
// Challenge opens the composer (or "create a team first").
export function ChallengeTeamsPage() {
  const navigate = useAppNavigate();
  const [params] = useSearchParams();
  const opponentParam = params.get("opponent");
  const userId = useAuthStore((s) => s.session?.user.id);
  const { coords } = useDeviceLocation();
  const { data: sports = [], isLoading: sportsLoading } = useSports();
  const { data: managedTeams = [], refetch: refetchManagedTeams } = useMyOwnedSquads(userId);
  const [sportId, setSportId] = useState(params.get("sport") ?? "");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"near" | "city">("near");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [sportOpen, setSportOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [opponent, setOpponent] = useState<SquadListItem | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const pendingCreateOpponentId = useRef<string | null>(null);
  const sport = sports.find((s) => s.id === sportId);
  const { data: squads = [], isLoading, error } = useSquads({ search, sportId: sportId || undefined });
  const managerIds = useMemo(() => managedTeams.map((t) => t.id).sort(), [managedTeams]);
  const { data: myChallenges = [] } = useTeamChallenges(managerIds);
  const pendingReceiverIds = useMemo(
    () => new Set(myChallenges.filter((c) => c.status === "pending" && managerIds.includes(c.sender_squad_id)).map((c) => c.receiver_squad_id)),
    [myChallenges, managerIds]
  );

  // Coming back from creating a team: refresh, and resume the challenge.
  useEffect(() => {
    const onFocus = () => void refetchManagedTeams();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchManagedTeams]);
  useEffect(() => {
    if (!pendingCreateOpponentId.current) return;
    const selected = squads.find((s) => s.id === pendingCreateOpponentId.current);
    if (selected && managedTeams.some((t) => t.sport_id === selected.sport_id)) {
      pendingCreateOpponentId.current = null;
      setOpponent(selected);
      setComposerOpen(true);
    }
  }, [managedTeams, squads]);

  const teams = useMemo(() => {
    const eligible = squads.filter(
      (t) =>
        t.group_type === "team" &&
        t.id !== opponent?.id &&
        t.squad_owner_id !== userId &&
        !t.squad_members.some((m) => m.status === "ACTIVE" && m.user_id === userId) &&
        !managedTeams.some((m) => m.id === t.id) &&
        challengeFormatsForSport(t.sports?.name).length > 0
    );
    const city = selectedCity?.trim().toLocaleLowerCase();
    const filtered = city ? eligible.filter((t) => [t.location, t.profiles?.city].some((v) => v?.toLocaleLowerCase().includes(city))) : eligible;
    return filtered
      .map((team) => {
        const lat = team.profiles?.latitude;
        const lng = team.profiles?.longitude;
        return { team, km: coords && lat != null && lng != null ? distanceKm(coords.latitude, coords.longitude, lat, lng) : null };
      })
      .sort((a, b) => {
        if (opponentParam === a.team.id) return -1;
        if (opponentParam === b.team.id) return 1;
        if (scope !== "near") return a.team.name.localeCompare(b.team.name);
        if (a.km == null) return b.km == null ? 0 : 1;
        if (b.km == null) return -1;
        return a.km - b.km;
      });
  }, [coords, managedTeams, opponent?.id, opponentParam, scope, selectedCity, squads, userId]);

  const startChallenge = (team: SquadListItem) => {
    setOpponent(team);
    if (managedTeams.some((m) => m.group_type === "team" && m.sport_id === team.sport_id)) setComposerOpen(true);
    else setManagerOpen(true);
  };

  return (
    <div className="min-h-dvh bg-app">
      <PlainHeader title="Challenge a Team" backFallback={paths.home} centered />
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <h2 className="text-base font-bold text-ink">Pick a team to challenge</h2>
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse filters" : "Expand filters"} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-raised">
            <Ionicon name={expanded ? "chevron-up" : "chevron-down"} size={19} color={colors.ink} />
          </button>
        </div>
        {expanded && (
          <div className="mx-3 mb-3 rounded-3xl border border-border bg-surface p-2.5 shadow-card">
            <label className="flex min-h-[46px] items-center rounded-2xl border border-border bg-surface-raised px-3">
              <Ionicon name="search-outline" size={19} color={colors.muted} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Team name or ID..." aria-label="Search teams" className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
                  <Ionicon name="close-circle" size={19} color={colors.muted} />
                </button>
              )}
            </label>
            <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
              <FilterChip icon="list-outline" label="My Challenges" onPress={() => navigate(paths.teamChallenges())} />
              <FilterChip icon="options-outline" label={sport?.name ?? "Sport"} active={!!sportId} onPress={() => setSportOpen(true)} />
              <FilterChip icon="navigate-outline" label="Near me" active={scope === "near"} bold onPress={() => (setScope("near"), setSelectedCity(null))} />
              <FilterChip icon="business-outline" label={selectedCity ?? "City"} active={!!selectedCity} onPress={() => setCityOpen(true)} />
            </div>
          </div>
        )}
        <div className="px-3 pb-10">
          {sportsLoading || isLoading ? (
            Array.from({ length: 6 }, (_, i) => <TeamRowSkeleton key={i} />)
          ) : (
            <>
              {error && <p className="mb-3 text-center text-danger">Could not load teams. Refresh and try again.</p>}
              {teams.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <Ionicon name="search-outline" size={38} color={colors.muted} />
                  <p className="mt-3 font-semibold text-ink">No teams found</p>
                  <p className="mt-1 text-muted">Try another name, sport, or location filter.</p>
                </div>
              ) : (
                teams.map(({ team, km }) => (
                  <div key={team.id} className="mb-1.5 flex min-h-14 items-center rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-card">
                    <button type="button" onClick={() => navigate(paths.squad(team.id))} className="flex min-w-0 flex-1 items-center text-left">
                      <GeneratedEntityVisual id={team.id} name={team.name} sport={team.sports?.name} kind="team" imageUrl={team.icon_url} size={36} />
                      <span className="ml-2 mr-1.5 min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{team.name}</span>
                        <span className="mt-0.5 flex items-center text-[11.5px] text-muted">
                          <Ionicon name="location" size={12} color={colors.muted} />
                          <span className="ml-1 truncate">
                            {team.location || team.profiles?.city || "Location not set"}
                            {km !== null ? ` · ${formatDistanceKm(km)}` : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                    {pendingReceiverIds.has(team.id) ? (
                      <span className="flex min-h-8 items-center rounded-lg border border-border bg-surface-raised px-2.5 text-[11.5px] font-bold text-muted">Pending</span>
                    ) : (
                      <button type="button" onClick={() => startChallenge(team)} className="min-h-8 rounded-lg bg-primary px-2.5 text-[11.5px] font-bold text-white hover:brightness-110">
                        Challenge
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
      <TeamManagerRequiredModal
        open={managerOpen}
        onClose={() => (setManagerOpen(false), setOpponent(null))}
        onCreateTeam={() => {
          if (opponent) pendingCreateOpponentId.current = opponent.id;
          setManagerOpen(false);
          navigate(paths.createSquadWith({ presetType: "team", lockType: true, presetSportId: opponent?.sport_id ?? sportId, lockSport: true }));
        }}
      />
      <SelectCitySheet open={cityOpen} value={selectedCity} onClose={() => setCityOpen(false)} onSelect={(city) => (setSelectedCity(city), setScope(city ? "city" : "near"), setCityOpen(false))} />
      <SelectSportSheet open={sportOpen} onClose={() => setSportOpen(false)} sports={sports} selectedSportId={sportId || undefined} subtitle="Choose a sport to filter teams" onApply={(id) => (setSportId(id ?? ""), setSportOpen(false))} />
      <TeamChallengeComposerModal
        open={composerOpen}
        senderTeams={managedTeams.filter((t) => t.group_type === "team")}
        opponent={opponent}
        onClose={() => (setComposerOpen(false), setOpponent(null))}
        onSent={() => {
          setComposerOpen(false);
          setOpponent(null);
          navigate(paths.teamChallenges());
        }}
      />
    </div>
  );
}

function TeamBadge({ team }: { team: TeamChallenge["sender"] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <GeneratedEntityVisual id={team.id} name={team.name} sport={team.sports?.name} kind="team" imageUrl={team.icon_url} size={28} />
      <span className="w-full truncate text-center text-[10.5px] font-semibold text-ink">{team.name}</span>
    </span>
  );
}

function ChallengeCardSkeleton() {
  return (
    <div className="mb-2 rounded-xl border border-border bg-surface p-2.5">
      <div className="flex items-center">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <SkeletonBlock width={28} height={28} radius={8} />
            <SkeletonBlock width={60} height={10} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <SkeletonBlock width="60%" height={11} />
        <SkeletonBlock width="75%" height={10} />
      </div>
    </div>
  );
}

type ChallengeTab = "received" | "sent" | "fixtures" | "history";

// Port of TeamChallengesScreen: Received / Sent / Fixtures / History for the
// teams you manage (fixtures: any team you play for).
export function TeamChallengesPage() {
  const navigate = useAppNavigate();
  const [params] = useSearchParams();
  const focusId = params.get("focus");
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: memberships = [], isLoading: membershipsLoading } = useMySquads(userId);
  const participantIds = useMemo(
    () =>
      memberships
        .filter((t) => isChallengeTeam(t) && (t.squad_owner_id === userId || t.squad_members.some((m) => m.status === "ACTIVE" && m.user_id === userId)))
        .map((t) => t.id)
        .sort(),
    [memberships, userId]
  );
  const { data: fixtures = [], isLoading: fixturesLoading } = useTeamFixtures(participantIds);
  const { data: managedTeams = [], isLoading: teamsLoading } = useMyOwnedSquads(userId);
  const managerIds = useMemo(() => managedTeams.filter(isChallengeTeam).map((t) => t.id).sort(), [managedTeams]);
  const { data: challenges = [], isLoading } = useTeamChallenges(managerIds);
  const respond = useRespondToTeamChallenge(managerIds);
  const cancel = useCancelTeamChallenge(managerIds);
  const [tab, setTab] = useState<ChallengeTab>("received");

  const visible = useMemo(() => {
    const selected = challenges.filter((c) => {
      const received = managerIds.includes(c.receiver_squad_id);
      const sent = managerIds.includes(c.sender_squad_id);
      // Pending or just-accepted cards stay put (now with "Go to Game").
      if (tab === "received") return received && (c.status === "pending" || c.status === "accepted");
      if (tab === "sent") return sent && (c.status === "pending" || c.status === "accepted");
      return c.status !== "pending";
    });
    if (focusId) {
      const focus = challenges.find((c) => c.id === focusId);
      if (focus && !selected.some((c) => c.id === focus.id)) return [focus, ...selected];
    }
    return selected;
  }, [challenges, managerIds, focusId, tab]);

  const answer = async (c: TeamChallenge, accept: boolean) => {
    try {
      await respond.mutateAsync({ challengeId: c.id, accept });
      Alert.alert(accept ? "Challenge accepted" : "Challenge declined", accept ? "The fixture has been confirmed for both teams." : "The sender has been notified.");
    } catch (err) {
      Alert.alert("Could not update challenge", getFriendlyErrorMessage(err, "Please try again."));
    }
  };
  const cancelPending = async (c: TeamChallenge) => {
    try {
      await cancel.mutateAsync(c.id);
    } catch (err) {
      Alert.alert("Could not cancel challenge", getFriendlyErrorMessage(err, "Please try again."));
    }
  };
  const busy = respond.isPending || cancel.isPending;
  const loading = !userId || teamsLoading || membershipsLoading || (tab === "fixtures" ? fixturesLoading : managerIds.length > 0 && isLoading);

  const empty = (title: string, body: string) => (
    <div className="flex flex-col items-center py-16 text-center">
      <Ionicon name="trophy-outline" size={42} color={colors.muted} />
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-muted">{body}</p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-app">
      <PlainHeader title="Team Challenges" subtitle="Requests and confirmed fixtures" backFallback={paths.challengeTeams()} />
      <div className="mx-auto w-full max-w-3xl">
        <div role="tablist" className="mx-3 mb-2.5 flex rounded-xl bg-surface-raised p-1">
          {(["received", "sent", "fixtures", "history"] as const).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 rounded-lg py-2 text-xs font-bold capitalize ${tab === key ? "bg-primary-light text-primary" : "text-muted"}`}>
              {key}
            </button>
          ))}
        </div>
        <div className="px-3 pb-10">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <ChallengeCardSkeleton key={i} />)
          ) : tab !== "fixtures" && managerIds.length === 0 ? (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <Ionicon name="shield-outline" size={42} color={colors.muted} />
              <p className="mt-3 text-lg font-bold text-ink">No managed team yet</p>
              <p className="mt-2 text-muted">Team owners and active hosts can manage challenges for supported sports.</p>
              <button type="button" onClick={() => navigate(paths.createSquadWith({ presetType: "team", lockType: true }))} className="mt-5 rounded-2xl bg-primary px-5 py-3 font-bold text-white">
                Create Team
              </button>
            </div>
          ) : tab === "fixtures" ? (
            fixtures.length === 0 ? (
              empty("No confirmed fixtures yet", "Fixtures involving your sports teams will appear here.")
            ) : (
              fixtures.map((f) => (
                <button key={f.id} type="button" onClick={() => navigate(paths.teamFixture(f.id))} className="mb-2 block w-full rounded-xl border border-border bg-surface p-2.5 text-left hover:border-primary/40">
                  <span className="flex items-center">
                    <span className="flex-1 truncate text-center font-bold text-ink">{f.home.name}</span>
                    <span className="px-3">
                      <Ionicon name="trophy" size={19} color={colors.primary} />
                    </span>
                    <span className="flex-1 truncate text-center font-bold text-ink">{f.away.name}</span>
                  </span>
                  <span className="mt-2 block text-center text-[11px] font-bold text-primary">
                    {f.status === "completed" ? "Completed" : "Confirmed fixture"} · {f.sportName} · {f.match_format}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
                    <Ionicon name="location-outline" size={14} color={colors.primary} />
                    <span className="truncate">{f.venue}</span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                    <Ionicon name="calendar-outline" size={14} color={colors.primary} />
                    {formatDate(f.scheduled_at)} · {formatTime(f.scheduled_at)}
                  </span>
                  {f.result && <span className="mt-2 block text-center font-bold text-ink">{f.result}</span>}
                </button>
              ))
            )
          ) : visible.length === 0 ? (
            empty(`No ${tab} challenges yet`, "Challenges to your managed teams will show here.")
          ) : (
            visible.map((c) => {
              const received = managerIds.includes(c.receiver_squad_id);
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(paths.teamChallenge(c.id))}
                  className={`mb-2 cursor-pointer rounded-xl border bg-surface p-2.5 hover:border-primary/40 ${c.id === focusId ? "border-primary" : "border-border"}`}
                >
                  <button type="button" aria-label={`Challenge details: ${c.sender.name} vs ${c.receiver.name}`} className="block w-full text-left">
                    <span className="flex items-center">
                      <TeamBadge team={c.sender} />
                      <span className="flex flex-col items-center px-1.5">
                        <Ionicon name="arrow-forward" size={17} color={colors.muted} />
                        <span className="mt-0.5 text-[10px] font-bold capitalize text-primary">{c.status}</span>
                      </span>
                      <TeamBadge team={c.receiver} />
                    </span>
                    <span className="mt-2 flex flex-col gap-1">
                      <span className="flex items-center gap-1 text-xs text-ink">
                        <Ionicon name="location-outline" size={13} color={colors.primary} />
                        <span className="truncate">{c.venue}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Ionicon name="calendar-outline" size={13} color={colors.primary} />
                        <span className="truncate">
                          {formatDate(c.scheduled_at)} · {formatTime(c.scheduled_at)} · {c.sender.sports?.name} · {c.match_format}
                        </span>
                      </span>
                      {c.fixture && <span className="text-[11px] font-semibold text-primary">Confirmed fixture · {c.fixture.id.slice(0, 8).toUpperCase()}</span>}
                    </span>
                  </button>
                  {c.status === "pending" ? (
                    <div className="mt-2.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {received ? (
                        <>
                          <button type="button" disabled={busy} onClick={() => void answer(c, false)} className="min-h-8 flex-1 rounded-lg border border-border bg-surface-raised text-[11px] font-bold text-ink">
                            Decline
                          </button>
                          <button type="button" disabled={busy} onClick={() => void answer(c, true)} className="min-h-8 flex-1 rounded-lg bg-primary text-[11px] font-bold text-white">
                            Accept
                          </button>
                        </>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => void cancelPending(c)} className="min-h-8 flex-1 rounded-lg border border-border bg-surface-raised text-[11px] font-bold text-ink">
                          Cancel challenge
                        </button>
                      )}
                    </div>
                  ) : c.status === "accepted" && c.fixture?.game_id ? (
                    <button
                      type="button"
                      onClick={(e) => (e.stopPropagation(), navigate(paths.game(c.fixture!.game_id!)))}
                      className="mt-2.5 min-h-8 w-full rounded-lg bg-primary text-[11px] font-bold text-white"
                    >
                      Go to Game
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Ionicon name={icon} size={19} color={colors.primary} />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

function DetailSkeleton({ rows }: { rows: { icon: string; label: string }[] }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <SkeletonBlock width={68} height={68} radius={20} />
            <SkeletonBlock width={80} height={14} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center rounded-xl bg-primary-light px-3 py-2">
        <SkeletonBlock width={70} height={14} />
      </div>
      <div className="mt-5 flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <Ionicon name={r.icon} size={19} color={colors.primary} />
            <div>
              <p className="text-xs text-muted">{r.label}</p>
              <SkeletonBlock width={140} height={14} style={{ marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center">
      <Ionicon name="alert-circle-outline" size={38} color={colors.muted} />
      <p className="mt-3 font-bold text-ink">{title}</p>
      <p className="mt-1 text-muted">{body}</p>
    </div>
  );
}

// Port of TeamChallengeDetailsScreen.
export function TeamChallengeDetailsPage() {
  const { challengeId = "" } = useParams();
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: squads = [], isLoading: squadsLoading } = useMyOwnedSquads(userId);
  const managerIds = useMemo(() => squads.filter(isChallengeTeam).map((s) => s.id).sort(), [squads]);
  const { data: challenges = [], isLoading, isFetching, refetch } = useTeamChallenges(managerIds);
  const challenge = challenges.find((c) => c.id === challengeId);
  // A challenge newer than the cached list (e.g. opened from a
  // notification) forces a refetch rather than waiting for the interval.
  useEffect(() => {
    if (managerIds.length > 0 && !challenge) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerIds.join(","), challengeId]);
  const respond = useRespondToTeamChallenge(managerIds);
  const cancel = useCancelTeamChallenge(managerIds);
  const isReceiver = challenge ? managerIds.includes(challenge.receiver_squad_id) : false;
  const isSender = challenge ? managerIds.includes(challenge.sender_squad_id) : false;
  const loading = !userId || squadsLoading || (managerIds.length > 0 && (isLoading || (isFetching && !challenge)));

  const handleResponse = async (accept: boolean) => {
    if (!challenge) return;
    try {
      await respond.mutateAsync({ challengeId: challenge.id, accept });
      Alert.alert(accept ? "Challenge accepted" : "Challenge declined", accept ? "The fixture is confirmed." : "The sender has been notified.");
    } catch (err) {
      Alert.alert("Could not update challenge", getFriendlyErrorMessage(err, "Please try again."));
    }
  };
  const handleCancel = async () => {
    if (!challenge) return;
    try {
      await cancel.mutateAsync(challenge.id);
      navigate(-1);
    } catch (err) {
      Alert.alert("Could not cancel challenge", getFriendlyErrorMessage(err, "Please try again."));
    }
  };

  return (
    <div className="min-h-dvh bg-app">
      <PlainHeader title="Challenge details" subtitle="Team match request" backFallback={paths.teamChallenges()} />
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2">
        {loading ? (
          <DetailSkeleton
            rows={[
              { icon: "location", label: "Venue" },
              { icon: "calendar", label: "Date and time" },
              { icon: "trophy", label: "Sport and format" },
              { icon: "time-outline", label: "Sent" },
            ]}
          />
        ) : !challenge ? (
          <Unavailable title="Challenge unavailable" body="It may have been removed or you may no longer manage either team." />
        ) : (
          <>
            <div className="rounded-3xl border border-border bg-surface p-5">
              <div className="flex items-center">
                {[challenge.sender, challenge.receiver].map((team) => (
                  <div key={team.id} className="flex flex-1 flex-col items-center gap-2">
                    <GeneratedEntityVisual id={team.id} name={team.name} sport={team.sports?.name} kind="team" imageUrl={team.icon_url} size={68} />
                    <p className="line-clamp-2 text-center font-bold text-ink">{team.name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-xl bg-primary-light px-3 py-2 text-center font-bold capitalize text-primary">{challenge.status}</p>
              <div className="mt-5 flex flex-col gap-4">
                <DetailRow icon="location" label="Venue" value={challenge.venue} />
                <DetailRow icon="calendar" label="Date and time" value={dateTime(challenge.scheduled_at)} />
                <DetailRow icon="trophy" label="Sport and format" value={`${challenge.sender.sports?.name ?? "Sport"} · ${challenge.match_format}`} />
                <DetailRow icon="time-outline" label="Sent" value={dateTime(challenge.created_at)} />
              </div>
            </div>
            {challenge.status === "accepted" && challenge.fixture?.game_id && (
              <button type="button" onClick={() => navigate(paths.game(challenge.fixture!.game_id!))} className="mt-4 w-full rounded-2xl bg-primary py-4 font-bold text-white">
                Go to Game
              </button>
            )}
            {challenge.status === "pending" && isReceiver && (
              <div className="mt-4 flex gap-2.5">
                <button type="button" disabled={respond.isPending} onClick={() => void handleResponse(false)} className="flex-1 rounded-2xl border border-border bg-surface-raised py-4 font-bold text-ink">
                  Decline
                </button>
                <button type="button" disabled={respond.isPending} onClick={() => void handleResponse(true)} className="flex-1 rounded-2xl bg-primary py-4 font-bold text-white">
                  Accept challenge
                </button>
              </div>
            )}
            {challenge.status === "pending" && isSender && (
              <button type="button" disabled={cancel.isPending} onClick={() => void handleCancel()} className="mt-4 w-full rounded-2xl border border-border bg-surface-raised py-4 font-bold text-ink">
                Cancel challenge
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Port of TeamFixtureDetailsScreen: the confirmed fixture; a manager can
// start (or reopen) its scorecard once the scheduled time arrives. Cricket
// fixtures carry the real rosters from the auto-created game into the new
// match, exactly like the app.
export function TeamFixtureDetailsPage() {
  const { fixtureId = "" } = useParams();
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: fixture, isLoading: fixtureLoading, error } = useTeamFixture(fixtureId);
  const { data: memberships = [] } = useMySquads(userId);
  const { data: managed = [] } = useMyOwnedSquads(userId);
  const isLoading = fixtureLoading || !userId;
  const memberOfFixture = fixture && memberships.some((t) => t.id === fixture.home_squad_id || t.id === fixture.away_squad_id);
  const isManager = fixture && managed.some((t) => (t.id === fixture.home_squad_id || t.id === fixture.away_squad_id) && t.group_type === "team");
  const canStart = Boolean(isManager && fixture?.status === "scheduled" && new Date(fixture.scheduled_at).getTime() <= Date.now());
  const linkedTable = fixture?.scorecard_table ?? (fixture?.football_match_id ? "football_matches" : null);
  const linkedMatchId = fixture?.scorecard_match_id ?? fixture?.football_match_id ?? null;
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (!fixture || starting) return;
    setStarting(true);
    try {
      let prefill: ScorecardPrefill | undefined;
      if (fixture.game_id && isCricketFamily(fixture.sportName)) {
        const [matches, teams] = await Promise.all([fetchMatchesForTournament(fixture.game_id), fetchTeamsForTournament(fixture.game_id)]);
        const match = matches[0];
        if (match?.cricket_match_id) {
          // Already started from the game's own page — open that scorecard.
          await linkTeamFixtureScorecard(fixture.id, match.cricket_match_id, "cricket_matches");
          navigate(paths.match("cricket", match.cricket_match_id));
          return;
        }
        if (match?.team_a && match?.team_b) {
          const roster = new Map(
            teams.map((t) => [t.id, t.tournament_team_members.filter((m) => m.status === "JOINED").map((m) => ({ name: m.profiles?.full_name ?? m.manual_name ?? "Player", userId: m.user_id }))])
          );
          const rawA = roster.get(match.team_a.id) ?? [];
          const rawB = roster.get(match.team_b.id) ?? [];
          const { teamANames, teamBNames } = disambiguateRoster(
            rawA.map((p) => ({ name: p.name, sourceId: p.userId })),
            rawB.map((p) => ({ name: p.name, sourceId: p.userId }))
          );
          prefill = {
            tournamentMatchId: match.id,
            gameId: fixture.game_id,
            teamAName: match.team_a.name,
            teamBName: match.team_b.name,
            teamAPlayers: rawA.map((p, i) => ({ name: teamANames[i], userId: p.userId })),
            teamBPlayers: rawB.map((p, i) => ({ name: teamBNames[i], userId: p.userId })),
            venue: fixture.venue,
            sportId: fixture.sport_id,
          };
        }
      }
      const teamFixture: TeamFixturePrefill = {
        fixtureId: fixture.id,
        sportId: fixture.sport_id,
        sportName: fixture.sportName,
        matchFormat: fixture.match_format as TeamFixturePrefill["matchFormat"],
        teamAName: fixture.home.name,
        teamBName: fixture.away.name,
        venue: fixture.venue,
      };
      navigate(paths.newMatch(matchSportFor(fixture.sportName)), { state: { teamFixture, prefill } });
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not start the scorecard."));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-app">
      <PlainHeader title="Team fixture" subtitle="Confirmed match details" backFallback={paths.teamChallenges()} />
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-2">
        {isLoading ? (
          <DetailSkeleton
            rows={[
              { icon: "location", label: "Venue" },
              { icon: "calendar", label: "Date and time" },
              { icon: "trophy", label: "Sport and format" },
            ]}
          />
        ) : !fixture || error || !memberOfFixture ? (
          <Unavailable title="Fixture unavailable" body={error ? getFriendlyErrorMessage(error, "This fixture is only visible to members of either team.") : "This fixture is only visible to members of either team."} />
        ) : (
          <div className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center">
              {[fixture.home, fixture.away].map((team) => (
                <div key={team.id} className="flex flex-1 flex-col items-center gap-2">
                  <GeneratedEntityVisual id={team.id} name={team.name} sport={fixture.sportName} kind="team" imageUrl={team.icon_url} size={68} />
                  <p className="line-clamp-2 text-center font-bold text-ink">{team.name}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-primary-light px-3 py-2 text-center font-bold capitalize text-primary">{fixture.status}</p>
            <div className="mt-5 flex flex-col gap-4">
              <DetailRow icon="location" label="Venue" value={fixture.venue} />
              <DetailRow icon="calendar" label="Date and time" value={dateTime(fixture.scheduled_at)} />
              <DetailRow icon="trophy" label="Sport and format" value={`${fixture.sportName} · ${fixture.match_format}`} />
            </div>
            {fixture.result && (
              <div className="mt-5 rounded-xl bg-surface-raised p-3">
                <p className="text-xs text-muted">Final result</p>
                <p className="mt-1 font-bold text-ink">{fixture.result}</p>
              </div>
            )}
            {isManager && linkedTable && linkedMatchId ? (
              <button type="button" onClick={() => navigate(paths.match(SPORT_BY_TABLE[linkedTable] ?? "football", linkedMatchId))} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-white">
                Open Scorecard
              </button>
            ) : isManager && canStart ? (
              <button type="button" disabled={starting} onClick={handleStart} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-white" style={{ opacity: starting ? 0.6 : 1 }}>
                {starting ? "Starting…" : `Start ${fixture.sportName} Scorecard`}
              </button>
            ) : isManager && fixture.status === "scheduled" ? (
              <p className="mt-5 text-center text-xs text-muted">The match scorecard will be available at the scheduled time.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
