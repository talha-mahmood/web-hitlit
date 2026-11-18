import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCommunityFeed,
  fetchCommentThread,
  postComment,
  updateComment,
  deleteComment,
  setCommentLiked,
  type CommunityComment,
} from "../lib/api/communityChat";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import type { Mention } from "../lib/mentionParser";

export function useCommunityFeed(userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["communityFeed", userId],
    queryFn: () => fetchCommunityFeed(userId),
    staleTime: 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("communityFeed"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_comments" },
        () => qc.invalidateQueries({ queryKey: ["communityFeed", userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_comment_likes" },
        () => qc.invalidateQueries({ queryKey: ["communityFeed", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

export function useCommentThread(rootId: string, userId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["commentThread", rootId, userId],
    queryFn: () => fetchCommentThread(rootId, userId),
    staleTime: 0,
    enabled: !!rootId,
  });

  useEffect(() => {
    if (!rootId) return;
    const channel = supabase
      .channel(uniqueChannelName(`commentThread:${rootId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_comments" },
        () => qc.invalidateQueries({ queryKey: ["commentThread", rootId, userId] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_comment_likes" },
        () => qc.invalidateQueries({ queryKey: ["commentThread", rootId, userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rootId, userId, qc]);

  return query;
}

export function usePostComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
      mentions,
      parentId,
      pollId,
    }: {
      userId: string;
      body: string;
      mentions?: Mention[];
      parentId?: string;
      pollId?: string;
    }) => postComment(userId, body, mentions ?? [], parentId, pollId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communityFeed"] });
      qc.invalidateQueries({ queryKey: ["commentThread"] });
    },
  });
}

// Author-only edit — see community_comments_update_self.
export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body, mentions }: { commentId: string; body: string; mentions?: Mention[] }) =>
      updateComment(commentId, body, mentions ?? []),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communityFeed"] });
      qc.invalidateQueries({ queryKey: ["commentThread"] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communityFeed"] });
      qc.invalidateQueries({ queryKey: ["commentThread"] });
    },
  });
}

function patchCommentLike(
  comments: CommunityComment[] | undefined,
  commentId: string,
  liked: boolean
): CommunityComment[] | undefined {
  if (!comments) return comments;
  return comments.map((c) =>
    c.id === commentId ? { ...c, likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) } : c
  );
}

export function useToggleCommentLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      commentId,
      userId,
      liked,
    }: {
      commentId: string;
      userId: string;
      liked: boolean;
    }) => setCommentLiked(commentId, userId, liked),
    // Flips the heart and +/-1's the count in the cache the instant it's
    // tapped, instead of waiting on the write to land and then a *second*
    // round trip (the onSuccess invalidate below used to be the only thing
    // that ever updated this) before anything visibly changed. commentId
    // alone doesn't say which thread(s) hold it, so every currently-cached
    // "commentThread" query gets the same patch attempt — one of them will
    // actually contain this comment, the rest are harmless no-ops.
    onMutate: async ({ commentId, userId, liked }) => {
      await qc.cancelQueries({ queryKey: ["communityFeed", userId] });
      await qc.cancelQueries({ queryKey: ["commentThread"] });

      const previousFeed = qc.getQueryData<CommunityComment[]>(["communityFeed", userId]);
      const previousThreads = qc.getQueriesData<CommunityComment[]>({ queryKey: ["commentThread"] });

      qc.setQueryData<CommunityComment[]>(["communityFeed", userId], (old) => patchCommentLike(old, commentId, liked));
      qc.setQueriesData<CommunityComment[]>({ queryKey: ["commentThread"] }, (old) => patchCommentLike(old, commentId, liked));

      return { previousFeed, previousThreads, userId };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      qc.setQueryData(["communityFeed", context.userId], context.previousFeed);
      for (const [key, data] of context.previousThreads) {
        qc.setQueryData(key, data);
      }
    },
    // Still reconciles with the server afterward (in case of a late realtime
    // echo or a second device), it just no longer gates the initial feedback.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["communityFeed"] });
      qc.invalidateQueries({ queryKey: ["commentThread"] });
    },
  });
}
