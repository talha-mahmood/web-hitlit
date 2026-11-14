import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors } from "@app/constants/theme";
import { useUserSearch } from "@app/hooks/useInvites";
import { useSquads } from "@app/hooks/useSquads";
import { useMyOwnedSquads, useMySquads } from "@app/hooks/useSquadTeamFill";
import type { UserSearchResult } from "@app/lib/api/users";
import type { SquadListItem } from "@app/lib/api/squads";
import type { Database } from "@app/types/database.types";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "../icons/Icon";
import { Avatar } from "../ui/Avatar";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";
import FieldInput from "../ui/FieldInput";
import { SectionLabel } from "../forms/FormControls";

type Gender = Database["public"]["Enums"]["game_gender_type"];

// Ports of the app's game/team sheets: InviteUsersModal, SquadFillModal,
// AddManualMemberModal, InviteSquadModal, CreateTeamModal, RenameTeamModal,
// SelectTeamModal and FillTeamWithSquadModal.

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3 pt-3">
      <h2 className="truncate text-lg font-bold text-ink">{title}</h2>
      <button type="button" aria-label="Close" onClick={onClose}>
        <Ionicon name="close" size={22} color={colors.muted} />
      </button>
    </div>
  );
}

function PrimaryButton({ enabled, busy, onClick, children, className = "mt-6 rounded-xl" }: { enabled: boolean; busy?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || busy}
      className={`flex w-full items-center justify-center py-4 text-base font-semibold ${className} ${enabled ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
    >
      {busy ? <Spinner color="white" /> : children}
    </button>
  );
}

function SelectRow({ selected, onPress, children, radio }: { selected: boolean; onPress: () => void; children: ReactNode; radio?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition ${selected ? (radio ? "border-primary bg-primary-light" : "border-primary") : "border-border hover:border-primary/40"}`}
    >
      {children}
      <Ionicon
        name={radio ? (selected ? "radio-button-on" : "radio-button-off") : selected ? "checkmark-circle" : "ellipse-outline"}
        size={radio ? 20 : 22}
        color={selected ? colors.primary : colors.border}
      />
    </button>
  );
}

function MemberRow({ m }: { m: SquadListItem["squad_members"][number] }) {
  const name = m.profiles?.full_name ?? "Member";
  return (
    <>
      <Avatar url={m.profiles?.avatar} name={name} size={36} />
      <span className="flex-1 truncate text-sm font-medium text-ink">{name}</span>
    </>
  );
}

function SquadInitialRow({ s }: { s: SquadListItem }) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">{s.name.charAt(0).toUpperCase()}</span>
      <span className="flex-1 truncate text-sm font-semibold uppercase text-ink">{s.name}</span>
    </>
  );
}

export function InviteUsersModal({ open, onClose, excludeIds, onInvite, title = "Invite Players" }: { open: boolean; onClose: () => void; excludeIds: string[]; onInvite: (user: UserSearchResult) => Promise<void>; title?: string }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebounced("");
      setInvitingId(null);
      setInvitedIds(new Set());
    }
  }, [open]);

  const { data: results, isLoading } = useUserSearch(debounced, excludeIds);

  const invite = async (user: UserSearchResult) => {
    setInvitingId(user.id);
    try {
      await onInvite(user);
      setInvitedIds((prev) => new Set(prev).add(user.id));
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send invite."));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <div className="mt-3">
        <FieldInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or user ID"
          autoFocus
          left={<span className="mr-2"><Ionicon name="search-outline" size={18} color={colors.muted} /></span>}
        />
      </div>
      <div className="mt-4 max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="mt-6 flex justify-center">
            <Spinner />
          </div>
        ) : !debounced ? (
          <p className="mt-6 text-center text-sm text-muted">Start typing a name or email to find players.</p>
        ) : (results ?? []).length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">No players found for "{debounced}".</p>
        ) : (
          (results ?? []).map((user) => {
            const invited = invitedIds.has(user.id);
            const inviting = invitingId === user.id;
            return (
              <div key={user.id} className="flex items-center gap-2.5 border-b border-border py-2.5">
                <Avatar url={user.avatar} name={user.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{user.full_name ?? "Unnamed player"}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">ID: {user.user_code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => invite(user)}
                  disabled={invited || inviting}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${invited ? "bg-green-50 text-primary" : "bg-brand text-white"}`}
                >
                  {inviting ? <Spinner size={14} color={invited ? colors.primary : "white"} /> : invited ? (
                    <>
                      <Ionicon name="checkmark" size={14} color={colors.primary} />
                      Invited
                    </>
                  ) : (
                    "Invite"
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

export function SquadFillModal({
  open,
  onClose,
  userId,
  requiredCount,
  submitting,
  title = "Fill With Your Group",
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  requiredCount: number;
  submitting: boolean;
  title?: string;
  onSubmit: (squadId: string, memberUserIds: string[]) => void;
}) {
  const { data: squads, isLoading } = useMyOwnedSquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const eligible = (squads ?? []).filter((s) => s.squad_members.filter((m) => m.status === "ACTIVE").length >= requiredCount);

  useEffect(() => {
    if (!open) {
      setSelectedSquad(null);
      setSelected(new Set());
    } else if (eligible.length === 1 && !selectedSquad) setSelectedSquad(eligible[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eligible.length]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < requiredCount) next.add(id);
      return next;
    });
  const canSubmit = !!selectedSquad && selected.size === requiredCount;
  const members = selectedSquad ? selectedSquad.squad_members.filter((m) => m.status === "ACTIVE") : [];

  return (
    <Modal open={open} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      {isLoading ? (
        <div className="my-6 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <p className="mb-2 mt-2 text-xs font-semibold text-muted">Choose a Group</p>
          {eligible.length === 0 ? (
            <p className="mb-2 text-sm text-muted">
              You don't own a group with at least {requiredCount} active member{requiredCount === 1 ? "" : "s"}.
            </p>
          ) : (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {eligible.map((s) => {
                const sel = selectedSquad?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => (setSelectedSquad(s), setSelected(new Set()))}
                    className={`shrink-0 rounded-xl border-[1.5px] px-3 py-2 text-sm font-medium ${sel ? "border-primary bg-brand text-white" : "border-border bg-surface text-ink"}`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
          {eligible.length > 0 && (
            <>
              {selectedSquad && (
                <>
                  <p className="mb-2 mt-4 text-xs font-semibold text-muted">
                    Select exactly {requiredCount} member{requiredCount === 1 ? "" : "s"} ({selected.size}/{requiredCount} selected)
                  </p>
                  <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
                    {members.map((m) => (
                      <SelectRow key={m.id} selected={selected.has(m.user_id)} onPress={() => toggle(m.user_id)}>
                        <MemberRow m={m} />
                      </SelectRow>
                    ))}
                  </div>
                </>
              )}
              <PrimaryButton enabled={canSubmit} busy={submitting} onClick={() => canSubmit && onSubmit(selectedSquad!.id, [...selected])}>
                Register {requiredCount} Member{requiredCount === 1 ? "" : "s"}
              </PrimaryButton>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function NameSheet({
  open,
  onClose,
  title,
  description,
  label,
  placeholder,
  initial = "",
  submitLabel,
  noun,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  initial?: string;
  submitLabel: string;
  noun: string;
  submitting: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  const save = () => {
    if (!isValidName(name)) {
      Alert.alert("Invalid Name", `${noun} name must be ${NAME_REQUIREMENT_HINT}.`);
      return;
    }
    onSubmit(name.trim());
  };
  return (
    <Modal open={open} onClose={onClose}>
      <SheetHeader title={title} onClose={onClose} />
      <p className="mb-2 text-sm text-muted">{description}</p>
      <SectionLabel title={label} required />
      <form onSubmit={(e) => (e.preventDefault(), name.trim() && save())}>
        <FieldInput value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={60} autoFocus />
        <PrimaryButton enabled={!!name.trim()} busy={submitting} onClick={save}>
          {submitLabel}
        </PrimaryButton>
      </form>
    </Modal>
  );
}

// Port of AddManualMemberModal: one name row per player (blank rows are
// ignored), capped at the open slots when known; they're added right away,
// without an app account.
export function AddManualMemberModal({
  open,
  onClose,
  onSubmit,
  submitting,
  maxPlayers,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (names: string[]) => void;
  submitting: boolean;
  maxPlayers?: number | null;
}) {
  const [names, setNames] = useState<string[]>([""]);
  useEffect(() => {
    if (open) setNames([""]);
  }, [open]);
  const canAddRow = maxPlayers == null || names.length < maxPlayers;
  const trimmed = names.map((n) => n.trim()).filter((n) => n.length > 0);
  const save = () => {
    if (trimmed.find((n) => !isValidName(n))) return Alert.alert("Invalid Name", `Player name must be ${NAME_REQUIREMENT_HINT}.`);
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Players Manually"
      subtitle="For players who don't have an app account — they're added to the team right away."
      footer={
        <button
          type="button"
          onClick={save}
          disabled={trimmed.length === 0 || submitting}
          className={`flex w-full items-center justify-center rounded-xl py-4 text-base font-semibold ${trimmed.length > 0 ? "press bg-brand text-white shadow-cta" : "bg-gray-200 text-muted"}`}
        >
          {submitting ? <Spinner size={20} color="white" /> : trimmed.length > 1 ? `Add ${trimmed.length} Players` : "Add Player"}
        </button>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), save())} className="pb-1 pt-1">
        {names.map((name, i) => (
          <div key={i} className="mb-3">
            <p className="mb-1.5 text-sm font-semibold text-ink">
              Player {i + 1} Name{i === 0 && <span className="text-danger"> *</span>}
            </p>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <FieldInput value={name} onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))} placeholder="e.g. Imran Khan" maxLength={60} autoFocus={i === 0} aria-label={`Player ${i + 1} name`} />
              </div>
              {names.length > 1 && (
                <button type="button" aria-label={`Remove player ${i + 1}`} onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}>
                  <Ionicon name="close-circle" size={22} color={colors.muted} />
                </button>
              )}
            </div>
          </div>
        ))}
        {canAddRow && (
          <button type="button" onClick={() => setNames((prev) => [...prev, ""])} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-primary py-2.5 text-sm font-bold text-primary hover:bg-primary-light">
            <Ionicon name="add" size={16} color={colors.primary} />
            Add Another Player
          </button>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export function CreateTeamModal({ open, onClose, onSubmit, submitting }: { open: boolean; onClose: () => void; onSubmit: (name: string) => void; submitting: boolean }) {
  return (
    <NameSheet
      open={open}
      onClose={onClose}
      title="Create a Team"
      description="Give your team a name — invite players to join, and it's added to the tournament automatically once your roster is full."
      label="Team Name"
      placeholder="e.g. Thunder Strikers"
      submitLabel="Create Team"
      noun="Team"
      submitting={submitting}
      onSubmit={onSubmit}
    />
  );
}

export function RenameTeamModal({ open, initialName, onClose, onSubmit, submitting }: { open: boolean; initialName: string; onClose: () => void; onSubmit: (name: string) => void; submitting: boolean }) {
  return (
    <NameSheet
      open={open}
      onClose={onClose}
      title="Rename Team"
      description="Change this team's name before its roster fills up."
      label="Team Name"
      placeholder="e.g. Thunder Strikers"
      initial={initialName}
      submitLabel="Save"
      noun="Team"
      submitting={submitting}
      onSubmit={onSubmit}
    />
  );
}

export function InviteSquadModal({
  open,
  onClose,
  submitting,
  alreadyInvitedSquadIds,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  alreadyInvitedSquadIds: string[];
  onInvite: (squadId: string, squadName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: squads, isLoading } = useSquads({ search: search || undefined });
  return (
    <Modal open={open} onClose={onClose}>
      <SheetHeader title="Invite a Group" onClose={onClose} />
      <p className="mb-2 text-sm text-muted">Search for a group and invite it to join — its owner completes the actual join once they see the invite.</p>
      <FieldInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by group name"
        autoFocus
        left={<span className="mr-2"><Ionicon name="search-outline" size={18} color={colors.muted} /></span>}
      />
      {isLoading ? (
        <div className="my-6 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-3 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
          {(squads ?? []).length === 0 && <p className="mt-4 text-center text-sm text-muted">No groups found.</p>}
          {(squads ?? []).map((s) => {
            const invited = alreadyInvitedSquadIds.includes(s.id);
            return (
              <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{s.squad_members.filter((m) => m.status === "ACTIVE").length} active members</p>
                </div>
                <button
                  type="button"
                  onClick={() => onInvite(s.id, s.name)}
                  disabled={submitting || invited}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${invited ? "bg-gray-100 text-muted" : "bg-brand text-white shadow-cta"}`}
                >
                  {invited ? "Invited" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// SelectTeamModal / FillTeamWithSquadModal are full-screen modals in the app
// (green header with a close X) — a full-height panel here.
function FullScreenPanel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 hidden bg-black/40 sm:block" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full animate-fadeUp flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[88dvh] sm:max-w-[560px] sm:rounded-3xl sm:shadow-hero">
        <div className="relative flex items-center justify-center bg-brand px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] sm:pt-4">
          <button type="button" aria-label="Close" onClick={onClose} className="absolute left-4">
            <Ionicon name="close" size={24} color="white" />
          </button>
          <span className="text-base font-bold text-white">{title}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function SelectTeamModal({
  open,
  onClose,
  userId,
  requiredCount,
  defaultTeamName,
  submitting,
  isHost,
  excludeUserIds,
  gameGender,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  requiredCount: number;
  defaultTeamName: string;
  submitting: boolean;
  isHost: boolean;
  excludeUserIds: string[];
  gameGender: Gender;
  onSubmit: (squadId: string, memberUserIds: string[], teamName: string) => void;
}) {
  const { data: squads, isLoading } = useMyOwnedSquads(userId);
  const [teamName, setTeamName] = useState(defaultTeamName);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const exclude = new Set(excludeUserIds);
  const available = (s: SquadListItem) => s.squad_members.filter((m) => m.status === "ACTIVE" && !exclude.has(m.user_id));
  const genderOk = (s: SquadListItem) => gameGender === "mixed" || s.gender === gameGender;
  const enough = (s: SquadListItem) => available(s).length >= requiredCount;
  const eligible = (squads ?? []).filter((s) => enough(s) && genderOk(s));
  const blockedByGender = gameGender !== "mixed" && (squads ?? []).some((s) => enough(s) && !genderOk(s));

  useEffect(() => {
    if (open) setTeamName(defaultTeamName);
    else {
      setSelectedSquad(null);
      setSelected(new Set());
    }
  }, [open, defaultTeamName]);
  useEffect(() => {
    if (open && eligible.length === 1 && !selectedSquad) setSelectedSquad(eligible[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eligible.length]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < requiredCount) next.add(id);
      return next;
    });
  const canSubmit = !!teamName.trim() && !!selectedSquad && selected.size === requiredCount;
  const members = selectedSquad ? available(selectedSquad) : [];
  const hidden = selectedSquad ? selectedSquad.squad_members.filter((m) => m.status === "ACTIVE" && exclude.has(m.user_id)).length : 0;

  return (
    <FullScreenPanel open={open} onClose={onClose} title="Select Team">
      <p className="mb-2 text-sm font-bold text-ink">Team Name</p>
      <FieldInput value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Thunder Strikers" maxLength={60} />
      <p className="mb-2 mt-6 text-xs font-semibold text-muted">Select one from your existing groups</p>
      {isLoading ? (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      ) : eligible.length === 0 ? (
        <p className="text-sm text-muted">
          {blockedByGender
            ? `This is open to ${gameGender} players only — register a ${gameGender} group to create a team.`
            : `You don't own a group with at least ${requiredCount} active member${requiredCount === 1 ? "" : "s"}.`}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {eligible.map((s) => (
            <SelectRow key={s.id} radio selected={selectedSquad?.id === s.id} onPress={() => (setSelectedSquad(s), setSelected(new Set()))}>
              <SquadInitialRow s={s} />
            </SelectRow>
          ))}
        </div>
      )}
      {selectedSquad && (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold text-muted">
            Select exactly {requiredCount} member{requiredCount === 1 ? "" : "s"} ({selected.size}/{requiredCount} selected)
          </p>
          {hidden > 0 && (
            <p className="mb-2 text-xs text-muted">
              {hidden} group member{hidden === 1 ? "" : "s"} already playing for another team in this tournament {hidden === 1 ? "isn't" : "aren't"} shown.
            </p>
          )}
          <div className="flex max-h-[352px] flex-col gap-2 overflow-y-auto">
            {members.map((m) => (
              <SelectRow key={m.id} selected={selected.has(m.user_id)} onPress={() => toggle(m.user_id)}>
                <MemberRow m={m} />
              </SelectRow>
            ))}
          </div>
        </>
      )}
      <p className="mt-6 text-center text-xs text-muted">
        {isHost ? "You're the host, so this team is added to the tournament immediately." : "This team will be sent to the host for approval before it's added."}
      </p>
      <PrimaryButton className="mt-4 rounded-xl" enabled={canSubmit} busy={submitting} onClick={() => canSubmit && onSubmit(selectedSquad!.id, [...selected], teamName.trim())}>
        CREATE NEW TEAM
      </PrimaryButton>
    </FullScreenPanel>
  );
}

export function FillTeamWithSquadModal({
  open,
  onClose,
  userId,
  remainingSlots,
  submitting,
  excludeUserIds,
  gameGender,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | undefined;
  remainingSlots: number;
  submitting: boolean;
  excludeUserIds: string[];
  gameGender: Gender;
  onSubmit: (squadId: string, memberUserIds: string[], isHostSquad: boolean) => void;
}) {
  const { data: squads, isLoading } = useMySquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const exclude = new Set(excludeUserIds);
  const available = (s: SquadListItem) => s.squad_members.filter((m) => m.status === "ACTIVE" && !exclude.has(m.user_id));
  const eligible = (squads ?? []).filter((s) => available(s).length > 0 && (gameGender === "mixed" || s.gender === gameGender));
  const isHostSquad = (s: SquadListItem) => s.squad_owner_id === userId || s.squad_members.some((m) => m.user_id === userId && m.role === "host" && m.status === "ACTIVE");

  useEffect(() => {
    if (!open) {
      setSelectedSquad(null);
      setSelected(new Set());
    }
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remainingSlots) next.add(id);
      return next;
    });
  const canSubmit = selected.size > 0 && !!selectedSquad;
  const direct = !!selectedSquad && isHostSquad(selectedSquad);

  return (
    <FullScreenPanel open={open} onClose={onClose} title="Fill With My Group">
      <p className="mb-2 text-xs font-semibold text-muted">Select a group</p>
      {isLoading ? (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      ) : eligible.length === 0 ? (
        <p className="text-sm text-muted">You don't have a group with an eligible member to invite right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {eligible.map((s) => (
            <SelectRow key={s.id} radio selected={selectedSquad?.id === s.id} onPress={() => (setSelectedSquad(s), setSelected(new Set()))}>
              <SquadInitialRow s={s} />
            </SelectRow>
          ))}
        </div>
      )}
      {selectedSquad && (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold text-muted">
            Select up to {remainingSlots} member{remainingSlots === 1 ? "" : "s"} to invite ({selected.size}/{remainingSlots} selected)
          </p>
          <div className="flex max-h-[352px] flex-col gap-2 overflow-y-auto">
            {available(selectedSquad).map((m) => (
              <SelectRow key={m.id} selected={selected.has(m.user_id)} onPress={() => toggle(m.user_id)}>
                <MemberRow m={m} />
              </SelectRow>
            ))}
          </div>
        </>
      )}
      <p className="mt-6 text-center text-xs text-muted">
        {direct
          ? "You're the host of this group — selected members are added to the team right away and notified."
          : "Each selected player gets their own request — they join once they approve it from Notifications."}
      </p>
      <PrimaryButton className="mt-4 rounded-xl" enabled={canSubmit} busy={submitting} onClick={() => canSubmit && onSubmit(selectedSquad!.id, [...selected], direct)}>
        {direct ? `ADD (${selected.size}) MEMBER${selected.size === 1 ? "" : "S"}` : `SEND (${selected.size}) REQUEST${selected.size === 1 ? "" : "S"}`}
      </PrimaryButton>
    </FullScreenPanel>
  );
}
