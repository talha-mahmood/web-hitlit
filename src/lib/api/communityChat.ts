import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type CommentRow = Database["public"]["Tables"]["community_comments"]["Row"];

export type CommunityComment = Pick<
  CommentRow,
  "id" | "user_id" | "parent_id" | "root_id" | "body" | "created_at"
> & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  likeCount: number;
  likedByMe: boolean;
};

// The plain `profiles(...)` embed is ambiguous here — PostgREST finds two
// paths from community_comments to profiles (the direct user_id FK, and an
// indirect many-to-many one through community_comment_likes, which also has
// FKs to both tables) and refuses the query with a 300 "more than one
// relationship was found" error. Naming the FK constraint picks the direct
// one explicitly.
const COMMENT_SELECT =
  "id, user_id, parent_id, root_id, body, created_at, profiles!community_comments_user_id_fkey(id, full_name, avatar)";

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
  return withLikes((data ?? []) as unknown as Omit<CommunityComment, "likeCount" | "likedByMe">[], userId);
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
  return withLikes((data ?? []) as unknown as Omit<CommunityComment, "likeCount" | "likedByMe">[], userId);
}

export async function postComment(
  userId: string,
  body: string,
  parentId?: string
): Promise<void> {
  const { error } = await supabase
    .from("community_comments")
    .insert({ user_id: userId, body, parent_id: parentId ?? null });
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
