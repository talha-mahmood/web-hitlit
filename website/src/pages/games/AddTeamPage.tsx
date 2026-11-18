import { useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useMyOwnedSquads, useSquadFillTournamentTeam } from "@app/hooks/useSquadTeamFill";
import { useSquadDetail } from "@app/hooks/useSquads";
import type { SquadListItem } from "@app/lib/api/squads";
import type { AddTeamParams } from "@app/navigation/addTeamTypes";
import { useAuthStore } from "@app/store/authStore";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { AddMemberByIdField } from "@/components/squads/AddMemberById";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

function MemberRow({ name, avatar }: { name: string | null; avatar: string | null }) {
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
      <Avatar url={avatar} name={name ?? "?"} size={36} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name ?? "Member"}</span>
      <Ionicon name="checkmark-circle" size={18} color={colors.primary} />
    </div>
  );
}

// Port of AddTeamScreen: claim an empty tournament team slot with one of your
// team-type squads (squad_fill_tournament_team validates server-side). Once a
// squad is picked: fewer players than needed → add by ID until full; exactly
// enough → confirm; more → pick exactly `required`. The AddTeamParams travel
// in history state (they're too rich for a URL).
export default function AddTeamPage() {
  const { gameId = "" } = useParams();
  const params = (useLocation().state as { addTeam?: AddTeamParams } | null)?.addTeam;
  if (!params || params.gameId !== gameId) return <Navigate to={paths.game(gameId)} replace />;
  return <AddTeamFlow params={params} />;
}

function AddTeamFlow({ params }: { params: AddTeamParams }) {
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.game(params.gameId));
  const userId = useAuthStore((s) => s.session?.user.id);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(params.squadId ?? null);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const { data: ownedSquads, isLoading: squadsLoading } = useMyOwnedSquads(userId);
  const { data: squad, isLoading: squadLoading } = useSquadDetail(selectedSquadId ?? "");
  const squadFillTeam = useSquadFillTournamentTeam(params.gameId);

  const required = params.requiredSize;
  const excludeSet = new Set(params.excludeUserIds);
  const genderEligible = (s: SquadListItem) => params.gameGender === "mixed" || s.gender === params.gameGender;
  const eligibleCountFor = (s: SquadListItem) => s.squad_members.filter((m) => m.status === "ACTIVE" && !excludeSet.has(m.user_id)).length;
  const teamSquads = (ownedSquads ?? []).filter((s) => s.group_type === "team");

  const handleCreateTeam = () =>
    navigate(paths.createSquadWith({ presetType: "team", lockType: true }), {
      state: { returnTo: { gameId: params.gameId, teamId: params.teamId, requiredSize: params.requiredSize, excludeUserIds: params.excludeUserIds, gameGender: params.gameGender } },
    });

  // A squad picked from the list (not one just created) goes back to the list.
  const handleBack = () => {
    if (selectedSquadId && !params.squadId) {
      setSelectedSquadId(null);
      setPickedIds(new Set());
    } else goBack();
  };

  const handleConfirm = (memberUserIds: string[]) => {
    if (!squad) return;
    squadFillTeam.mutate(
      { teamId: params.teamId, squadId: squad.id, memberUserIds, teamName: squad.name },
      {
        onSuccess: () => {
          Alert.alert("Team Added", `"${squad.name}" has been added to this match.`);
          navigate(paths.game(params.gameId), { replace: true });
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not register this team.")),
      }
    );
  };

  const togglePick = (memberId: string) =>
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else if (next.size < required) next.add(memberId);
      return next;
    });

  const activeMembers = squad ? squad.squad_members.filter((m) => m.status === "ACTIVE" && !excludeSet.has(m.user_id)) : [];
  const hiddenCount = squad ? squad.squad_members.filter((m) => m.status === "ACTIVE" && excludeSet.has(m.user_id)).length : 0;
  const count = activeMembers.length;

  const confirmButton = (ids: string[], enabled: boolean) => (
    <button
      type="button"
      onClick={() => handleConfirm(ids)}
      disabled={!enabled || squadFillTeam.isPending}
      className={`mt-4 flex w-full items-center justify-center rounded-xl py-4 text-base font-bold ${enabled ? "press bg-brand text-white shadow-cta" : "bg-gray-200 text-muted"}`}
    >
      {squadFillTeam.isPending ? <Spinner size={20} color="white" /> : "Confirm Team"}
    </button>
  );

  return (
    <div className="bg-app">
      <header className="relative flex items-center justify-center bg-brand px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:rounded-b-3xl">
        <button type="button" onClick={handleBack} aria-label="Back" className="absolute left-4 rounded-full p-1 hover:bg-white/15">
          <Ionicon name={selectedSquadId && !params.squadId ? "arrow-back" : "close"} size={22} color="white" />
        </button>
        <h1 className="text-base font-bold text-white">Add Team</h1>
      </header>
      <main className="mx-auto w-full max-w-xl p-5 pb-10">
        {required <= 0 ? (
          <p className="mt-6 text-center text-sm text-muted">Team size isn't set for this match.</p>
        ) : !selectedSquadId ? (
          <>
            <p className="mb-3 text-sm font-bold text-ink">Select one of your teams</p>
            {squadsLoading ? (
              <div className="mt-4 flex justify-center">
                <Spinner />
              </div>
            ) : teamSquads.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-border p-6">
                <Ionicon name="people-outline" size={28} color={colors.border} />
                <p className="mb-4 mt-2 text-center text-sm text-muted">You don't have a team yet.</p>
                <button type="button" onClick={handleCreateTeam} className="press rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-cta">
                  Create Team
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {teamSquads.map((s) => {
                  const eligible = genderEligible(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!eligible}
                      onClick={() => (setSelectedSquadId(s.id), setPickedIds(new Set()))}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left enabled:hover:border-primary/40"
                      style={{ opacity: eligible ? 1 : 0.5 }}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">{s.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{eligible ? `${eligibleCountFor(s)}/${required} players` : `Open to ${params.gameGender} players only`}</span>
                      </span>
                      <Ionicon name="chevron-forward" size={18} color={colors.muted} />
                    </button>
                  );
                })}
                <button type="button" onClick={handleCreateTeam} className="mt-2 py-2 text-sm font-semibold text-primary hover:underline">
                  + Create a new team
                </button>
              </div>
            )}
          </>
        ) : squadLoading || !squad ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <p className="mb-3 text-xs text-muted">
                {hiddenCount} member{hiddenCount === 1 ? "" : "s"} already playing for another team in this match {hiddenCount === 1 ? "isn't" : "aren't"} shown.
              </p>
            )}
            {count < required ? (
              <>
                <p className="mb-1 text-base font-bold text-ink">Add Players to Your Team</p>
                <p className="mb-4 text-sm text-muted">
                  {count}/{required} players added
                </p>
                {activeMembers.map((m) => (
                  <MemberRow key={m.id} name={m.profiles?.full_name ?? null} avatar={m.profiles?.avatar ?? null} />
                ))}
                <div className="mt-3">
                  <AddMemberByIdField squadId={squad.id} excludeUserIds={[squad.squad_owner_id, ...squad.squad_members.map((m) => m.user_id)]} />
                </div>
              </>
            ) : count === required ? (
              <>
                <p className="mb-1 text-base font-bold text-ink">Confirm Your Team</p>
                <p className="mb-4 text-sm text-muted">
                  {squad.name} — {count}/{required} players
                </p>
                {activeMembers.map((m) => (
                  <MemberRow key={m.id} name={m.profiles?.full_name ?? null} avatar={m.profiles?.avatar ?? null} />
                ))}
                {confirmButton(
                  activeMembers.map((m) => m.user_id),
                  true
                )}
              </>
            ) : (
              <>
                <p className="mb-1 text-base font-bold text-ink">Select Your Lineup</p>
                <p className="mb-4 text-sm text-muted">
                  Select exactly {required} player{required === 1 ? "" : "s"} ({pickedIds.size}/{required} selected)
                </p>
                {activeMembers.map((m) => {
                  const selected = pickedIds.has(m.user_id);
                  const name = m.profiles?.full_name ?? "Member";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => togglePick(m.user_id)}
                      className={`mb-2 flex w-full items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 text-left ${selected ? "border-primary" : "border-border"}`}
                    >
                      <Avatar url={m.profiles?.avatar} name={name} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name}</span>
                      <Ionicon name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.primary : colors.border} />
                    </button>
                  );
                })}
                {confirmButton(Array.from(pickedIds), pickedIds.size === required)}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
