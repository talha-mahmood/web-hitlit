import { useState } from "react";
import { useLookupProfileByUserCode, useAddSquadMemberDirect } from "@app/hooks/useSquads";
import type { UserCodeLookupResult } from "@app/lib/api/squads";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Avatar } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";

// Port of AddMemberByIdField: type a player's ID and add them straight into
// the squad as ACTIVE (no invite to accept). Used in the squad page's sheet
// and inline in Add Team's add-until-full flow.
export function AddMemberByIdField({
  squadId,
  excludeUserIds,
  disabledReason,
  onAdded,
}: {
  squadId: string;
  excludeUserIds: string[];
  disabledReason?: string;
  onAdded?: (profile: UserCodeLookupResult) => void;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<UserCodeLookupResult | null | "not_searched">("not_searched");
  const lookup = useLookupProfileByUserCode();
  const addDirect = useAddSquadMemberDirect(squadId);

  const handleLookup = () => {
    if (!code.trim()) return;
    lookup.mutate(code.trim(), {
      onSuccess: (profile) => setResult(profile),
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Lookup failed.")),
    });
  };

  const handleAdd = () => {
    if (result === "not_searched" || !result) return;
    if (excludeUserIds.includes(result.id)) return Alert.alert("Already Added", `${result.full_name ?? "This player"} is already in this squad.`);
    addDirect.mutate(result.id, {
      onSuccess: () => {
        onAdded?.(result);
        setCode("");
        setResult("not_searched");
      },
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not add this player.")),
    });
  };

  if (disabledReason) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted">{disabledReason}</p>;
  }

  return (
    <div>
      <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), handleLookup())}>
        <div className="min-w-0 flex-1">
          <FieldInput
            value={code}
            onChange={(e) => (setCode(e.target.value), setResult("not_searched"))}
            placeholder="Enter player ID (e.g. AB12CD)"
            autoCapitalize="characters"
            autoCorrect="off"
            aria-label="Player ID"
          />
        </div>
        <button type="submit" disabled={lookup.isPending || !code.trim()} className="press flex shrink-0 items-center justify-center rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-cta disabled:opacity-70">
          {lookup.isPending ? <Spinner size={16} color="white" /> : "Find"}
        </button>
      </form>
      {result && result !== "not_searched" && (
        <div className="mt-3 flex items-center rounded-xl border border-primary bg-primary-light px-4 py-3">
          <Avatar url={result.avatar} name={result.full_name ?? "?"} size={40} className="mr-3" />
          <div className="mr-3 min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{result.full_name || "No name set"}</p>
            <p className="mt-0.5 text-xs text-muted">ID: {result.user_code}</p>
          </div>
          <button type="button" onClick={handleAdd} disabled={addDirect.isPending} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">
            {addDirect.isPending ? <Spinner size={14} color="white" /> : "Add"}
          </button>
        </div>
      )}
      {result === null && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">No player found with that ID. Double check and try again.</p>}
    </div>
  );
}

// Port of AddMemberByIdModal: the sheet around the field.
export function AddMemberByIdModal({ open, onClose, squadId, excludeUserIds, disabledReason }: { open: boolean; onClose: () => void; squadId: string; excludeUserIds: string[]; disabledReason?: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Add Player by ID" subtitle="They're added instantly — no invite to accept.">
      <div className="pb-2">
        <AddMemberByIdField squadId={squadId} excludeUserIds={excludeUserIds} disabledReason={disabledReason} />
      </div>
    </Modal>
  );
}
