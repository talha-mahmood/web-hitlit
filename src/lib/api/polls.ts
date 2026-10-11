import { supabase } from "../supabase";
import { uniqueChannelName } from "../realtimeChannel";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PollOptionResult = {
  id: string;
  text: string;
  voteCount: number;
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

  const { data: votes, error: votesError } = await supabase
    .from("poll_votes")
    .select("option_id, voter_id")
    .eq("poll_id", pollId);
  if (votesError) throw new Error(votesError.message);

  const counts = new Map<string, number>();
  let myOptionId: string | null = null;
  for (const vote of votes ?? []) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    if (vote.voter_id === viewerId) myOptionId = vote.option_id;
  }

  return {
    id: poll.id,
    question: poll.question,
    createdBy: poll.created_by,
    options: (options ?? []).map((o) => ({ id: o.id, text: o.option_text, voteCount: counts.get(o.id) ?? 0 })),
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
