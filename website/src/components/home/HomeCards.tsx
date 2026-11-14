import { colors } from "@app/constants/theme";
import { getSportIcon } from "@app/lib/sportIcons";
import { getSportImage } from "@app/lib/sportImages";
import { formatDistanceKm } from "@app/lib/distance";
import { dayLabel, timeBadgeColor } from "@app/lib/badgeColors";
import type { GameListItem } from "@app/lib/api/games";
import type { SquadListItem } from "@app/lib/api/squads";
import type { EventListItem } from "@app/lib/api/events";
import GeneratedEntityVisual from "../GeneratedEntityVisual";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "../icons/Icon";
import { AvatarStack } from "../ui/Avatar";

// Ports of the app's HomeWideCards.tsx — same data rules and labels.

// "Filter by Sport" tile — photo-led rounded square; green border when selected.
export function HomeSportTile({ name, selected, onPress, compact }: { name: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  const photo = imageUrl(getSportImage(name));
  const { icon, bg, fg } = getSportIcon(name);
  return (
    <button type="button" onClick={onPress} aria-pressed={selected} className={`group flex shrink-0 flex-col items-center ${compact ? "w-[52px] sm:w-[60px]" : "w-[74px] sm:w-[84px]"}`}>
      <span
        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-[14px] border-[2.5px] transition ${photo ? "" : "bg-surface p-2.5"} ${
          selected ? "border-primary" : "border-transparent group-hover:border-primary/30"
        }`}
      >
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full" style={{ backgroundColor: bg }}>
            <MCIcon name={icon} size={30} color={fg} />
          </span>
        )}
      </span>
      <span className={`mt-1.5 w-full truncate text-center text-xs ${selected ? "font-bold text-primary" : "font-semibold text-ink"}`}>{name}</span>
    </button>
  );
}

export function HomeSquadCard({
  squad,
  currentUserId,
  myGender,
  distanceLabel,
  onChallenge,
  challengePending = false,
  onPress,
}: {
  squad: SquadListItem;
  currentUserId?: string;
  myGender?: string | null;
  distanceLabel?: string;
  onChallenge?: () => void;
  challengePending?: boolean;
  onPress: () => void;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted =
    squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;

  const statusLabel = isClosedToJoins
    ? "Full"
    : isGenderRestricted
      ? squad.gender === "male"
        ? "Male Only"
        : "Female Only"
      : hasJoined
        ? "Joined"
        : "Join";
  const muted = isClosedToJoins || isGenderRestricted;

  return (
    <div role="link" tabIndex={0} onClick={onPress} onKeyDown={(e) => e.key === "Enter" && onPress()} className="card press w-full cursor-pointer p-3 text-left hover:shadow-hero/40">
      <div className="flex items-center gap-2">
        <GeneratedEntityVisual id={squad.id} name={squad.name} sport={squad.sports?.name} kind={squad.group_type === "team" ? "team" : "squad"} imageUrl={squad.icon_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{squad.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {active.length}
            {squad.max_players ? `/${squad.max_players}` : ""} members
          </p>
        </div>
        {distanceLabel && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
            <Ionicon name="navigate-outline" size={13} color={colors.primary} />
            {distanceLabel} away
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AvatarStack people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))} size={22} />
        {onChallenge && challengePending ? (
          <span className="flex min-h-[30px] items-center rounded-full border border-border bg-surface-raised px-3 text-xs font-bold text-muted">Pending</span>
        ) : onChallenge ? (
          <button
            type="button"
            aria-label={`Challenge ${squad.name}`}
            onClick={(e) => (e.stopPropagation(), onChallenge())}
            className="min-h-[30px] rounded-full bg-primary px-3 text-xs font-bold text-white hover:brightness-110"
          >
            Challenge
          </button>
        ) : (
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: muted ? colors.surfaceOverlay : colors.primaryLight, color: muted ? colors.muted : colors.primary }}>
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// Port of HomeEventCard ("Events near you").
export function HomeEventCard({ event, currentUserId, myGender, onPress }: { event: EventListItem; currentUserId?: string; myGender?: string | null; onPress: () => void }) {
  const active = event.event_members.filter((m) => m.status === "ACTIVE");
  const isClosed = event.join_requests_blocked;
  const hasJoined = event.event_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = event.event_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted = event.gender !== "mixed" && (!myGender || myGender !== event.gender) && !hasJoined && !hasRequested;
  const statusLabel = isClosed ? "Closed" : isGenderRestricted ? (event.gender === "male" ? "Male Only" : "Female Only") : hasJoined ? "Joined" : "Join";
  const muted = isClosed || isGenderRestricted;
  return (
    <button type="button" onClick={onPress} className="card press w-full p-3 text-left hover:shadow-hero/40">
      <div className="flex items-center gap-2">
        <GeneratedEntityVisual id={event.id} name={event.name} sport={event.event_type} kind="event" imageUrl={event.icon_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{event.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {active.length} member{active.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AvatarStack people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))} size={22} />
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: muted ? colors.surfaceOverlay : colors.primaryLight, color: muted ? colors.muted : colors.primary }}>
          {statusLabel}
        </span>
      </div>
    </button>
  );
}

function formatTime(startTime: string): string {
  return new Date(`2000-01-01T${startTime}`).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function HomeGameRowCard({ game, distanceKm, onPress }: { game: GameListItem; distanceKm: number | null; onPress: () => void }) {
  const isTournament = game.game_type === "TOURNAMENT";
  const isTeamBased = game.number_of_teams != null;
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const badgeColor = isTournament ? "#7C3AED" : timeBadgeColor(game.start_time);
  const placeName = game.venues?.name ?? game.custom_venue_name ?? "Location TBD";
  const isFull = game.status === "FULL" || (!isTeamBased && joined.length >= game.max_players);

  return (
    <button type="button" onClick={onPress} className="card press flex w-full items-center gap-3 p-3 text-left">
      <GeneratedEntityVisual id={game.id} name={game.title} sport={game.sports?.name} kind={isTournament ? "tournament" : "game"} imageUrl={game.icon_url} size={60} style={{ borderRadius: 14 }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{game.title}</p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: badgeColor }}>
            {dayLabel(game.game_date)}
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <Ionicon name="location-outline" size={12} color={colors.muted} />
          <span className="truncate">
            {placeName}
            {distanceKm !== null ? ` · ${formatDistanceKm(distanceKm)}` : ""}
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <Ionicon name="time-outline" size={12} color={colors.muted} />
          {formatTime(game.start_time)}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AvatarStack people={joined.map((p) => ({ avatar: p.profiles?.avatar ?? null, name: p.profiles?.full_name ?? null }))} size={20} />
            <span className="text-[11px] font-medium text-muted">
              {joined.length}
              {!isTeamBased ? `/${game.max_players}` : ""} joined
            </span>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: isFull ? colors.surfaceOverlay : colors.primaryLight, color: isFull ? colors.muted : colors.primary }}
          >
            {isTeamBased ? "View Details" : isFull ? "Full" : "Join"}
          </span>
        </div>
      </div>
    </button>
  );
}

export function NearbyEmptyRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface py-[22px]">
      <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
        <Ionicon name={icon} size={20} color={colors.muted} />
      </span>
      <p className="text-center text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
