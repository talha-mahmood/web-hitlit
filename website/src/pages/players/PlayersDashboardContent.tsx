import { useMemo, useState } from "react";
import { colors } from "@app/constants/theme";
import { useSports } from "@app/hooks/useSports";
import { useTopPlayers } from "@app/hooks/usePlayers";
import type { TopPlayer } from "@app/lib/api/players";
import { computeRankingRating, getRatingTierInfo } from "@app/lib/playerRating";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import Spinner from "@/components/ui/Spinner";
import { SelectSportSheet } from "@/components/filters/FilterSheets";

function PlayerRow({ player, rank, onPress }: { player: TopPlayer; rank: number; onPress: () => void }) {
  const rating = computeRankingRating(player);
  const tier = getRatingTierInfo(rating);
  return (
    <button type="button" onClick={onPress} className="card press flex w-full items-center px-4 py-3 text-left hover:shadow-hero">
      <span className="mr-3">
        <Avatar url={player.avatar} name={player.fullName} size={48} />
      </span>
      <span className="mr-2 min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand" />
          <span className="truncate text-sm font-bold text-ink">{player.fullName ?? "Player"}</span>
        </span>
        <span className="mt-1 block truncate text-xs text-muted">
          {player.gamesPlayedTotal} games · {player.tournamentsPlayedTotal} tournaments
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted/80">
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tier.bg }}>
            <Ionicon name="flame" size={11} color={tier.color} />
          </span>
          <span className="truncate">
            Rating {rating} · {tier.label}
          </span>
          <span className="flex shrink-0 items-center gap-[3px]">
            <Ionicon name="people-outline" size={12} color={colors.muted} />
            {player.followerCount} follower{player.followerCount === 1 ? "" : "s"}
          </span>
        </span>
      </span>
      <span className="text-xs font-semibold text-muted"># {rank < 10 ? `0${rank}` : rank}</span>
    </button>
  );
}

// Port of PlayersDashboardContent ("Top Players"): ranked by rating, then
// matches, then games; search by name or player ID keeps each player's real
// overall rank; sport filter sheet.
export default function PlayersDashboardContent({ onPressPlayer }: { onPressPlayer: (userId: string, sport?: { id: string; name: string }) => void }) {
  const [sportId, setSportId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const { data: sports } = useSports();
  const { data: players, isLoading } = useTopPlayers(sportId ?? undefined);

  const selectedSport = useMemo(() => {
    const match = sportId ? (sports ?? []).find((s) => s.id === sportId) : undefined;
    return match ? { id: match.id, name: match.name } : undefined;
  }, [sportId, sports]);

  const ranked = useMemo(
    () =>
      [...(players ?? [])].sort(
        (a, b) => computeRankingRating(b) - computeRankingRating(a) || b.matchesPlayedTotal - a.matchesPlayedTotal || b.gamesPlayedTotal - a.gamesPlayedTotal
      ),
    [players]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withRank = ranked.map((player, i) => ({ player, rank: i + 1 }));
    return q ? withRank.filter(({ player }) => (player.fullName ?? "").toLowerCase().includes(q) || (player.userCode ?? "").toLowerCase().includes(q)) : withRank;
  }, [ranked, search]);

  return (
    <div className="mx-auto w-full max-w-3xl px-3.5 pb-10 pt-1 lg:px-0">
      <div className="mb-3 flex items-center gap-2.5">
        <FieldInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players by name or ID"
          type="search"
          aria-label="Search players"
          containerClassName="flex-1"
          left={<span className="mr-2"><Ionicon name="search-outline" size={18} color={colors.muted} /></span>}
          right={
            search ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
                <Ionicon name="close-circle" size={18} color={colors.muted} />
              </button>
            ) : undefined
          }
        />
        <button
          type="button"
          onClick={() => setSportSheetOpen(true)}
          aria-label="Filter by sport"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-border bg-surface shadow-card hover:bg-gray-50"
        >
          <Ionicon name="options-outline" size={20} color={colors.ink} />
          {sportId && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />}
        </button>
      </div>

      {visible.length === 0 ? (
        isLoading ? (
          <div className="mt-10 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <Ionicon name="trophy-outline" size={48} color={colors.border} />
            <p className="text-base font-semibold text-ink">{search.trim() ? "No players found" : "No players yet"}</p>
            <p className="px-8 text-sm text-muted">
              {search.trim() ? "Try a different name." : sportId ? "No one has played this sport yet — be the first!" : "Play a game to show up on the leaderboard."}
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ player, rank }) => (
            <PlayerRow key={player.userId} player={player} rank={rank} onPress={() => onPressPlayer(player.userId, selectedSport)} />
          ))}
        </div>
      )}

      <SelectSportSheet
        open={sportSheetOpen}
        onClose={() => setSportSheetOpen(false)}
        sports={sports ?? []}
        selectedSportId={sportId ?? undefined}
        onApply={(id) => {
          setSportId(id ?? null);
          setSportSheetOpen(false);
        }}
      />
    </div>
  );
}
