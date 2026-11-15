import { colors } from "@app/constants/theme";
import { usePlayerTeamSquads } from "@app/hooks/useSquads";
import { Ionicon } from "@/components/icons/Icon";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import { EntityCard } from "./PlayerTabParts";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Port of PlayerTeamSquadsList: the player's real team-type squads (for
// every sport), replacing teams inferred from scorecard team names.
export default function PlayerTeamSquadsList({ userId, sportId }: { userId: string; sportId?: string | null }) {
  const navigate = useAppNavigate();
  const { data: squads, isLoading } = usePlayerTeamSquads(userId, sportId);
  if (isLoading)
    return (
      <div className="mt-4">
        <SkeletonCardRows count={3} />
      </div>
    );
  if (!squads || squads.length === 0)
    return (
      <div className="flex flex-col items-center py-10">
        <Ionicon name="people-outline" size={32} color={colors.muted} />
        <p className="mt-2 text-sm text-muted">No teams yet</p>
      </div>
    );
  return (
    <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-x-3">
      {squads.map((s) => (
        <EntityCard
          key={s.id}
          photoUrl={s.icon_url}
          title={s.name.toUpperCase()}
          subtitle={`${s.member_count} member${s.member_count === 1 ? "" : "s"}`}
          subtitleIcon="people-outline"
          pillLabel="Team"
          sportName={s.sports?.name ?? "cricket"}
          onPress={() => navigate(paths.squad(s.id))}
        />
      ))}
    </div>
  );
}
