// supabase-js dedupes supabase.channel(name) calls by topic name, returning
// the SAME already-subscribed channel object if one with that name exists.
// If the same screen/entity ends up mounted more than once at a time (e.g.
// reached via two different navigation stacks, or a tab that stays mounted
// in the background), a second `.on()` call lands on an already-subscribed
// channel and throws "cannot add postgres_changes callbacks ... after
// subscribe()". Appending a per-call random suffix keeps names readable for
// debugging while guaranteeing every subscription gets its own channel.
export function uniqueChannelName(base: string): string {
  return `${base}:${Math.random().toString(36).slice(2, 10)}`;
}
