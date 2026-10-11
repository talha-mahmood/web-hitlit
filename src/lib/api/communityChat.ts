import { supabase } from "../supabase";
import type { Database, Json } from "../../types/database.types";
import type { Mention } from "../mentionParser";

type CommentRow = Database["public"]["Tables"]["community_comments"]["Row"];

export type CommunityComment = Pick<
  CommentRow,
  "id" | "user_id" | "parent_id" | "root_id" | "body" | "created_at" | "updated_at" | "poll_id"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  likeCount: number;
  likedByMe: boolean;
  mentions: Mention[];
};

// The plain `profiles(...)` embed is ambiguous here — PostgREST finds two
// paths from community_comments to profiles (the direct user_id FK, and an
// indirect many-to-many one through community_comment_likes, which also has
// FKs to both tables) and refuses the query with a 300 "more than one
// relationship was found" error. Naming the FK constraint picks the direct
// one explicitly.
const COMMENT_SELECT =
  "id, user_id, parent_id, root_id, body, created_at, updated_at, poll_id, mentions, profiles!community_comments_user_id_fkey(id, full_name, avatar)";

// mentions comes back from PostgREST as plain jsonb — cast once, here,
// rather than at every call site.
function normalizeMentions(rows: unknown[]): (Omit<CommunityComment, "likeCount" | "likedByMe">)[] {
  return (rows as (Omit<CommunityComment, "likeCount" | "likedByMe" | "mentions"> & { mentions: unknown })[]).map((r) => ({
    ...r,
    mentions: Array.isArray(r.mentions) ? (r.mentions as Mention[]) : [],
  }));
}

// Attaches like counts/whether-I-liked to a batch of comments in one extra
// query, instead of a per-row round trip.
async function withLikes(
  rows: (Omit<CommunityComment, "likeCount" | "likedByMe">)[],
  userId: string | undefined
): Promise<CommunityComment[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: likes, error } = await supabase
    .from("community_comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", ids);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const like of likes ?? []) {
    counts.set(like.comment_id, (counts.get(like.comment_id) ?? 0) + 1);
    if (like.user_id === userId) mine.add(like.comment_id);
  }

  return rows.map((r) => ({
    ...r,
    likeCount: counts.get(r.id) ?? 0,
    likedByMe: mine.has(r.id),
  }));
}

// Top-level comments only, newest first — this is the main feed.
export async function fetchCommunityFeed(userId: string | undefined): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select(COMMENT_SELECT)
    .is("parent_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withLikes(normalizeMentions(data ?? []), userId);
}

// The root comment plus every reply anywhere in its thread (root_id is
// auto-filled server-side even for replies-to-replies), oldest first so a
// thread reads top-to-bottom like a conversation.
export async function fetchCommentThread(
  rootId: string,
  userId: string | undefined
): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select(COMMENT_SELECT)
    .or(`id.eq.${rootId},root_id.eq.${rootId}`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return withLikes(normalizeMentions(data ?? []), userId);
}

export async function postComment(
  userId: string,
  body: string,
  mentions: Mention[] = [],
  parentId?: string,
  pollId?: string
): Promise<void> {
  const { error } = await supabase
    .from("community_comments")
    .insert({ user_id: userId, body, mentions: mentions as unknown as Json, parent_id: parentId ?? null, poll_id: pollId ?? null });
  if (error) throw new Error(error.message);
}

// Author-only (community_comments_update_self) — the message keeps its id/
// created_at/likes, only body+mentions (and updated_at, via the trigger)
// change, so every existing reply/like stays attached to the same row.
export async function updateComment(commentId: string, body: string, mentions: Mention[] = []): Promise<void> {
  const { error } = await supabase
    .from("community_comments")
    .update({ body, mentions: mentions as unknown as Json })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("community_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

export async function setCommentLiked(
  commentId: string,
  userId: string,
  liked: boolean
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from("community_comment_likes")
      .insert({ comment_id: commentId, user_id: userId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("community_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}
