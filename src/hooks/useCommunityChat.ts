import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCommunityFeed,
  fetchCommentThread,
  postComment,
  updateComment,
  deleteComment,
  setCommentLiked,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communityFeed"] });
      qc.invalidateQueries({ queryKey: ["commentThread"] });
    },
  });
}
