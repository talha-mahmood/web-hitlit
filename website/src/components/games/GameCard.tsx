import type { MouseEvent } from "react";
import { colors } from "@app/constants/theme";
import type { GameListItem } from "@app/lib/api/games";
import { GAME_SKILL_COLORS, timeBadgeColor } from "@app/lib/badgeColors";
import { getSportCardThumb } from "@app/lib/sportImages";
import GeneratedEntityVisual from "../GeneratedEntityVisual";
import { getSportIcon } from "@app/lib/sportIcons";
import { imageUrl } from "@/lib/cn";
import { AvatarStack } from "../ui/Avatar";
import { Ionicon, MCIcon } from "../icons/Icon";

function fmtTime(t: string) {
  return new Date(`2000-01-01T${t}`).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
}

function cardDayLabel(dateStr: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(date, today)) return "Today";
  if (same(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}

function formatDateRange(gameDate: string, endDate: string): string {
  const [sy, sm, sd] = gameDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const fmt = (d: Date, withYear: boolean) => d.toLocaleDateString("en-PK", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
  return `${fmt(new Date(sy, sm - 1, sd), sy !== ey)} - ${fmt(new Date(ey, em - 1, ed), true)}`;
}

const SKILL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", PRO: "Pro" };

// Port of GamesListScreen's GameCard (same five rows as the Groups card):
// title, location, going/teams line + sport pill, when-badge, skill + fee;
// the Join / Joined / Requested / Full / My Game CTA pinned top-right and
// the sport photo in a green disc on the right edge.
export default function GameCard({
  game,
  onPress,
  onJoinPress,
  onTeamJoinPress,
  currentUserId,
  index = 0,
}: {
  game: GameListItem;
  onPress: () => void;
  onJoinPress: () => void;
  onTeamJoinPress: () => void;
  currentUserId?: string;
  index?: number;
}) {
  const isTournament = game.game_type === "TOURNAMENT";
  const isTeamBased = game.number_of_teams != null;
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const hasJoinedTeam =
    isTeamBased &&
    !!currentUserId &&
    game.tournament_teams.some((t) => t.status !== "REJECTED" && t.tournament_team_members.some((m) => m.user_id === currentUserId && m.status === "JOINED"));
  const hasJoined = isTeamBased ? hasJoinedTeam : game.game_players.some((p) => p.user_id === currentUserId && p.status === "JOINED");
  const hasRequested = !isTeamBased && game.game_players.some((p) => p.user_id === currentUserId && p.status === "PENDING");
  const approvedTeams = game.tournament_teams.filter((t) => t.status === "APPROVED");
  const spotsLeft = game.max_players - joined.length;
  const teamsLeft = (game.number_of_teams ?? 0) - approvedTeams.length;
  const isFull = game.status === "FULL" || (isTeamBased ? teamsLeft <= 0 : spotsLeft <= 0);
  const isCompleted = game.status === "COMPLETED";
  const isMyGame = game.creator_id === currentUserId || (!!currentUserId && (game.co_host_ids ?? []).includes(currentUserId));
  const skillColor = game.skill_level ? GAME_SKILL_COLORS[game.skill_level] : null;
  const skillLabel = game.skill_level ? SKILL_LABEL[game.skill_level] : null;
  const multiDay = isTournament && !!game.end_date && game.end_date !== game.game_date;
  const badgeLabel = multiDay ? formatDateRange(game.game_date, game.end_date!) : `${cardDayLabel(game.game_date)} · ${fmtTime(game.start_time)} - ${fmtTime(game.end_time)}`;
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);
  const sportName = game.sports?.name ?? "";
  const sportPhoto = imageUrl(getSportCardThumb(sportName));
  const glyph = getSportIcon(sportName);

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
      className="press relative min-h-[146px] animate-fadeUp cursor-pointer overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition-shadow hover:shadow-hero"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="absolute right-2.5 top-2.5 z-[5] text-[11.5px] font-bold">
        {isMyGame ? (
          <span className="block rounded-2xl bg-blue-50 px-2 py-1 text-blue-600">{isTournament ? "My Tournament" : "My Game"}</span>
        ) : isCompleted ? (
          <span className="block rounded-2xl bg-gray-100 px-2 py-1 text-muted">Completed</span>
        ) : isFull && !hasJoined ? (
          <span className="block rounded-2xl bg-red-50 px-2 py-1 text-red-600">Full</span>
        ) : hasJoined ? (
          <button type="button" onClick={stop(onPress)} className="flex min-w-[60px] items-center justify-center gap-[3px] rounded-2xl bg-green-50 px-2 py-1 font-semibold text-primary">
            <Ionicon name="checkmark-circle" size={13} color={colors.primary} />
            Joined
          </button>
        ) : hasRequested ? (
          <button type="button" onClick={stop(onJoinPress)} className="min-w-[60px] rounded-2xl bg-orange-50 px-2 py-1 font-semibold text-orange-600">
            Requested
          </button>
        ) : (
          <button type="button" onClick={stop(isTeamBased ? onTeamJoinPress : onJoinPress)} className="min-w-[60px] rounded-2xl bg-brand px-2 py-1 text-white shadow-cta transition active:scale-95">
            Join
          </button>
        )}
      </div>

      <span className="pointer-events-none absolute -right-7 top-11 flex h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-full bg-primary-light">
        <GeneratedEntityVisual id={game.id} name={game.title} sport={sportName} kind={isTournament ? "tournament" : "game"} imageUrl={game.icon_url} size={48} style={{ marginRight: 17 }} />
      </span>

      <div className="px-2.5 pb-2 pt-2">
        <div className="mb-1 flex items-center gap-1.5 pr-20">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-primary-light">
            {sportPhoto ? <img src={sportPhoto} alt="" className="h-[26px] w-11 object-contain" /> : <MCIcon name={glyph.icon} size={26} color={glyph.fg} style={{ opacity: 0.8 }} />}
          </span>
          <p className="flex-1 truncate text-sm font-extrabold text-ink">{game.title}</p>
        </div>
        <p className="mb-1 flex items-center gap-1 pr-[92px] text-[11.5px] text-muted">
          <Ionicon name="location-outline" size={12} color={colors.muted} />
          <span className="truncate">{game.venues ? `${game.venues.name}${game.venues.city ? ` · ${game.venues.city}` : ""}` : (game.custom_venue_name ?? "Location not set")}</span>
        </p>
        <div className="mb-1.5 flex items-center gap-[5px] pr-[92px]">
          <AvatarStack people={joined.map((p) => ({ avatar: p.profiles?.avatar ?? null, name: p.profiles?.full_name ?? p.manual_name ?? null }))} size={20} />
          <span className="truncate text-[11.5px] font-medium text-muted">
            {isTeamBased
              ? `${approvedTeams.length} team${approvedTeams.length !== 1 ? "s" : ""} · ${Math.max(teamsLeft, 0)} left`
              : `${joined.length} Going · ${Math.max(spotsLeft, 0)} left`}
          </span>
          <span className="shrink-0 truncate rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary">{game.sports?.name ?? "Sport"}</span>
        </div>
        <span className="inline-flex max-w-full items-center gap-[3px] rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: badgeColor }}>
          <Ionicon name={multiDay ? "calendar-outline" : "time-outline"} size={11} color="white" />
          <span className="truncate">{badgeLabel}</span>
        </span>
        <div className="mt-1.5 flex min-h-[22px] items-center">
          {skillColor && skillLabel && (
            <>
              <span className="flex items-center gap-1 rounded-full px-[9px] py-1 text-[11px] font-bold text-white" style={{ backgroundColor: skillColor }}>
                <Ionicon name="stats-chart" size={11} color="white" />
                {skillLabel}
              </span>
              <span className="mx-2 h-4 w-px bg-border" />
            </>
          )}
          <Ionicon name="ticket-outline" size={13} color={colors.muted} style={{ marginRight: 5 }} />
          <span className="truncate text-xs">
            <span className="font-bold text-primary">{game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}</span>
            <span className="text-muted">{isTournament ? " per team" : " per person"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
