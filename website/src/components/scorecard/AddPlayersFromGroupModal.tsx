import { useEffect, useState } from "react";
import { colors } from "@app/constants/theme";
import { useMySquads } from "@app/hooks/useSquadTeamFill";
import type { SquadListItem } from "@app/lib/api/squads";
import { useAuthStore } from "@app/store/authStore";
import { Ionicon } from "../icons/Icon";
import { Avatar } from "../ui/Avatar";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";

// Port of AddPlayersFromGroupModal: fill a scorecard's player-name fields
// from one of your groups. Picks carry the member's account id so two real
// people sharing a display name stay distinguishable; `maxSelect` caps picks
// to the empty slots the caller can accept.
export default function AddPlayersFromGroupModal({
  open,
  onClose,
  onAdd,
  excludedUserIds,
  maxSelect = Infinity,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (picked: { userId: string; name: string }[]) => void;
  excludedUserIds: string[];
  maxSelect?: number;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: squads, isLoading } = useMySquads(userId);
  const [selectedSquad, setSelectedSquad] = useState<SquadListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSelectedSquad(null);
      setSelectedIds(new Set());
    } else if ((squads ?? []).length === 1 && !selectedSquad) {
      setSelectedSquad(squads![0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, squads?.length]);

  const excluded = new Set(excludedUserIds);
  const activeMembers = (selectedSquad?.squad_members ?? []).filter((m) => m.status === "ACTIVE");

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxSelect) next.add(id);
      return next;
    });

  const handleAdd = () => {
    const picked = activeMembers
      .filter((m) => selectedIds.has(m.id))
      .map((m) => ({ userId: m.user_id, name: m.profiles?.full_name?.trim() ?? "" }))
      .filter((p) => !!p.name);
    if (picked.length === 0) return;
    onAdd(picked);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add From a Group"
      footer={
        selectedSquad && !isLoading && (squads ?? []).length > 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedIds.size === 0}
            className={`w-full rounded-xl py-4 text-base font-semibold ${selectedIds.size > 0 ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
          >
            {selectedIds.size > 0 ? `Add ${selectedIds.size} Player${selectedIds.size === 1 ? "" : "s"}` : "Add Players"}
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (squads ?? []).length === 0 ? (
        <p className="mb-2 mt-1 text-sm text-muted">You're not in any groups yet — join or create one to add players from it here.</p>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold text-muted">Choose a Group</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(squads ?? []).map((s) => {
              const selected = selectedSquad?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => (setSelectedSquad(s), setSelectedIds(new Set()))}
                  className={`shrink-0 rounded-xl border-[1.5px] px-3 py-2 text-sm font-medium ${selected ? "border-primary bg-brand text-white" : "border-border bg-surface text-ink hover:border-primary/40"}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>

          {selectedSquad && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold text-muted">
                {maxSelect === Infinity ? `Select players to add (${selectedIds.size} selected)` : `Select up to ${maxSelect} (${selectedIds.size}/${maxSelect} selected)`}
              </p>
              {activeMembers.length === 0 ? (
                <p className="mb-2 text-sm text-muted">This group has no active members.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeMembers.map((m) => {
                    const name = m.profiles?.full_name?.trim() ?? "";
                    const alreadyAdded = excluded.has(m.user_id);
                    const selected = selectedIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={alreadyAdded}
                        aria-pressed={selected}
                        onClick={() => !alreadyAdded && toggle(m.id)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-primary" : "border-border hover:border-primary/40"} ${alreadyAdded ? "opacity-50" : ""}`}
                      >
                        <Avatar url={m.profiles?.avatar} name={name || "?"} size={36} />
                        <span className="flex-1 truncate text-sm font-medium text-ink">{name || "Unnamed player"}</span>
                        {alreadyAdded ? (
                          <span className="text-xs text-muted">Added</span>
                        ) : (
                          <Ionicon name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.primary : colors.border} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
