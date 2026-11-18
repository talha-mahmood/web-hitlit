import { useEffect, useState } from "react";
import { colors } from "@app/constants/theme";
import { usePollResult, useCastPollVote } from "@app/hooks/usePolls";
import type { PollResult } from "@app/lib/api/polls";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";
import { Avatar } from "../ui/Avatar";
import { Ionicon } from "../icons/Icon";

const MAX_OPTIONS = 6;

// Port of PollCreateModal: question + 2–6 options, "Create Poll" enabled once
// there's a question and at least two non-empty options.
export function PollCreateModal({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
  creating?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  useEffect(() => {
    if (open) {
      setQuestion("");
      setOptions(["", ""]);
    }
  }, [open]);

  const trimmed = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && trimmed.length >= 2 && !creating;
  const fieldClass = "w-full rounded-2xl border-[1.5px] border-border px-4 py-3 text-[14.5px] text-ink outline-none placeholder:text-muted focus:border-primary";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Poll"
      subtitle="Ask a question, members vote for one option"
      footer={
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => canCreate && onCreate(question.trim(), trimmed)}
          className={`w-full rounded-2xl py-4 text-base font-bold ${canCreate ? "press bg-brand text-white shadow-cta" : "cursor-not-allowed bg-gray-200 text-muted"}`}
        >
          {creating ? "Creating…" : "Create Poll"}
        </button>
      }
    >
      <label className="mb-1.5 block text-xs font-bold text-ink">Question</label>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. What time should we start?"
        maxLength={200}
        rows={2}
        className={`${fieldClass} resize-none`}
      />
      <label className="mb-1.5 mt-4 block text-xs font-bold text-ink">Options</label>
      {options.map((option, index) => (
        <div key={index} className="mb-2.5 flex items-center gap-2">
          <input
            value={option}
            onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))}
            placeholder={`Option ${index + 1}`}
            maxLength={100}
            className={fieldClass}
          />
          {options.length > 2 && (
            <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))} className="p-1">
              <Ionicon name="close-circle" size={22} color={colors.muted} />
            </button>
          )}
        </div>
      ))}
      {options.length < MAX_OPTIONS && (
        <button type="button" onClick={() => setOptions((prev) => [...prev, ""])} className="mb-2 mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Ionicon name="add-circle-outline" size={18} color={colors.primary} />
          Add option
        </button>
      )}
    </Modal>
  );
}

// Port of PollResultsModal: options most-voted first with each voter listed.
export function PollResultsModal({ open, onClose, poll }: { open: boolean; onClose: () => void; poll: PollResult | undefined }) {
  const options = [...(poll?.options ?? [])].sort((a, b) => b.voteCount - a.voteCount);
  const total = poll?.totalVotes ?? 0;
  return (
    <Modal open={open} onClose={onClose} title={poll?.question ?? "Poll results"} subtitle={`${total} vote${total === 1 ? "" : "s"}`}>
      {options.map((option) => (
        <div key={option.id} className="mt-3 border-b border-border pb-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="mr-2 flex-1 text-sm font-bold text-ink">{option.text}</p>
            <span className="text-xs font-semibold text-muted">
              {option.voteCount} vote{option.voteCount === 1 ? "" : "s"}
            </span>
          </div>
          {option.voters.length === 0 ? (
            <p className="pb-1 text-xs text-muted">No votes yet</p>
          ) : (
            option.voters.map((voter) => (
              <div key={voter.id} className="flex items-center gap-2.5 py-2">
                <Avatar url={voter.avatar} name={voter.fullName} size={36} />
                <span className="truncate text-sm font-medium text-ink">{voter.fullName ?? "Player"}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </Modal>
  );
}

// Port of PollMessageCard: tap an option to vote (or change your vote), bars
// show each option's share, tapping the question / vote count opens results.
export function PollMessageCard({
  pollId,
  fallbackQuestion,
  viewerId,
  fullWidth,
}: {
  pollId: string;
  fallbackQuestion: string;
  viewerId: string | undefined;
  fullWidth?: boolean;
}) {
  const { data: poll, isLoading } = usePollResult(pollId, viewerId);
  const castVote = useCastPollVote(pollId);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const handleVote = (optionId: string) => {
    if (!viewerId || castVote.isPending || optionId === poll?.myOptionId) return;
    setPendingOptionId(optionId);
    castVote.mutate({ optionId, voterId: viewerId }, { onSettled: () => setPendingOptionId(null) });
  };

  const totalVotes = poll?.totalVotes ?? 0;

  return (
    <div className={`rounded-2xl bg-surface p-3 shadow-card ${fullWidth ? "w-full" : "w-[min(260px,68vw)]"}`}>
      <button type="button" onClick={() => poll && setResultsOpen(true)} disabled={!poll} className="block w-full text-left">
        <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
          <Ionicon name="bar-chart" size={15} color={colors.primary} />
          POLL
        </span>
        <span className="mb-3 block text-sm font-bold text-ink">{poll?.question ?? fallbackQuestion}</span>
      </button>

      {isLoading && !poll ? (
        <div className="flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {poll?.options.map((option) => {
            const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            const isMine = option.id === poll.myOptionId;
            const isPending = castVote.isPending && pendingOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleVote(option.id)}
                disabled={castVote.isPending}
                aria-pressed={isMine}
                className={`relative overflow-hidden rounded-xl border-[1.5px] text-left transition ${isMine ? "border-primary" : "border-border hover:border-primary/40"}`}
              >
                <span className="pointer-events-none absolute inset-y-0 left-0 bg-primary-light transition-[width] duration-300" style={{ width: `${pct}%` }} />
                <span className="relative flex items-center justify-between px-3 py-2.5">
                  <span className="mr-2 flex flex-1 items-center gap-1.5">
                    {isMine && <Ionicon name="checkmark-circle" size={15} color={colors.primary} />}
                    <span className="line-clamp-2 text-sm font-medium text-ink">{option.text}</span>
                  </span>
                  {isPending ? <Spinner size={16} /> : <span className="text-xs font-bold text-muted">{pct}%</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button type="button" onClick={() => poll && setResultsOpen(true)} disabled={!poll} className="mt-3 text-xs text-muted hover:underline">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
      </button>

      <PollResultsModal open={resultsOpen} onClose={() => setResultsOpen(false)} poll={poll} />
    </div>
  );
}
