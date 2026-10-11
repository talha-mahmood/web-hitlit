import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PollVoter = {
  id: string;
  fullName: string | null;
  avatar: string | null;
};

export type PollOptionResult = {
  id: string;
  text: string;
  voteCount: number;
  voters: PollVoter[];
};

export type PollResult = {
  id: string;
  question: string;
  createdBy: string;
  options: PollOptionResult[];
  totalVotes: number;
  myOptionId: string | null;
};

// Creates the poll + its options in one go (two inserts — options need the
// poll's id first) and hands back just the poll id, which the caller then
// attaches to the chat message it's inserting (game/team/squad message, or
// community comment) via that row's poll_id column.
export async function createPoll(question: string, optionTexts: string[], createdBy: string): Promise<string> {
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .insert({ question, created_by: createdBy })
    .select("id")
    .single();
  if (pollError) throw new Error(pollError.message);

  const { error: optionsError } = await supabase.from("poll_options").insert(
    optionTexts.map((text, index) => ({ poll_id: poll.id, option_text: text, display_order: index }))
  );
  if (optionsError) throw new Error(optionsError.message);

  return poll.id;
}

export async function fetchPollResult(pollId: string, viewerId: string): Promise<PollResult> {
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id, question, created_by")
    .eq("id", pollId)
    .single();
  if (pollError) throw new Error(pollError.message);

  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, option_text, display_order")
    .eq("poll_id", pollId)
    .order("display_order", { ascending: true });
  if (optionsError) throw new Error(optionsError.message);

  // Who voted for what, shown on the poll results screen (tap a poll's vote
  // count to open it) — same as WhatsApp's poll detail view, which lists
  // voters per option rather than just a tally.
  const { data: votes, error: votesError } = await supabase
    .from("poll_votes")
    .select("option_id, voter_id, profiles(id, full_name, avatar)")
    .eq("poll_id", pollId);
  if (votesError) throw new Error(votesError.message);

  const votersByOption = new Map<string, PollVoter[]>();
  let myOptionId: string | null = null;
  for (const vote of (votes ?? []) as unknown as { option_id: string; voter_id: string; profiles: { id: string; full_name: string | null; avatar: string | null } | null }[]) {
    const list = votersByOption.get(vote.option_id) ?? [];
    list.push({ id: vote.voter_id, fullName: vote.profiles?.full_name ?? null, avatar: vote.profiles?.avatar ?? null });
    votersByOption.set(vote.option_id, list);
    if (vote.voter_id === viewerId) myOptionId = vote.option_id;
  }

  return {
    id: poll.id,
    question: poll.question,
    createdBy: poll.created_by,
    options: (options ?? []).map((o) => ({
      id: o.id,
      text: o.option_text,
      voteCount: votersByOption.get(o.id)?.length ?? 0,
      voters: votersByOption.get(o.id) ?? [],
    })),
    totalVotes: votes?.length ?? 0,
    myOptionId,
  };
}

// Single-choice: casting a vote for a different option just moves it
// (upsert on the poll_id+voter_id unique pair) instead of adding a second
// row — re-tapping the option you already picked is a no-op either way.
export async function castPollVote(pollId: string, optionId: string, voterId: string): Promise<void> {
  const { error } = await supabase
    .from("poll_votes")
    .upsert({ poll_id: pollId, option_id: optionId, voter_id: voterId }, { onConflict: "poll_id,voter_id" });
  if (error) throw new Error(error.message);
}

// One channel per rendered poll card — fine at this app's scale, and keeps
// each card's live updates scoped to just its own votes instead of every
// poll on screen re-fetching on every vote anywhere.
export function subscribeToPollVotes(pollId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`poll_votes:${pollId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` },
      onChange
    )
    .subscribe();
}
