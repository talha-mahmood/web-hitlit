import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useCommentThread, usePostComment, useUpdateComment, useDeleteComment, useToggleCommentLike } from "@app/hooks/useCommunityChat";
import { useBlockedUserIds, useBlockUser, useReportMessage } from "@app/hooks/useModeration";
import type { CommunityComment } from "@app/lib/api/communityChat";
import type { Mention } from "@app/lib/mentionParser";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { shareComment } from "@app/lib/commentShareLink";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";
import { MentionComposer } from "@/components/chat/Mentions";
import CommentCard from "@/components/community/CommentCard";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Port of CommentThreadScreen: the root comment, its replies (indented),
// and a reply composer pinned at the bottom. Opened from a shared link
// (hitlit.pk/comment/<id>?highlight=<replyId>) it scrolls to and flashes
// that reply for 3 seconds.
export default function CommentThreadPage() {
  const { rootId = "" } = useParams();
  const [search] = useSearchParams();
  const highlightParam = search.get("highlight") ?? undefined;
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.community + "/chat");
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | undefined>(highlightParam);

  const { data: thread, isLoading, error } = useCommentThread(rootId, userId);
  const postComment = usePostComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();

  const { data: blockedIds } = useBlockedUserIds(userId);
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(userId);
  const handleReport = (comment: CommunityComment, reason: string) => {
    if (!userId) return;
    reportMessage.mutate(
      { reporterId: userId, reportedUserId: comment.user_id, source: "community_message", sourceId: comment.id, contextId: comment.root_id ?? comment.id, messageSnapshot: comment.body, reason },
      {
        onSuccess: () => Alert.alert("Reported", "Thanks — we'll review this message."),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not submit report.")),
      }
    );
  };
  const handleBlock = (comment: CommunityComment) =>
    blockUser.mutate(comment.user_id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block user.")) });

  const root = thread?.find((c) => c.id === rootId);
  const replies = (thread ?? []).filter((c) => c.id !== rootId && !blockedIds?.has(c.user_id));
  const hasReplies = replies.length > 0;

  useEffect(() => {
    if (!highlightParam || !hasReplies) return;
    const scroll = setTimeout(() => {
      document.getElementById(`comment-${highlightParam}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    const clear = setTimeout(() => setHighlightedId(undefined), 3000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [highlightParam, hasReplies]);

  const handleSend = (body: string, mentions: Mention[]) => {
    if (!userId) return;
    postComment.mutate(
      { userId, body, mentions, parentId: replyTarget?.id ?? rootId },
      { onSuccess: () => setReplyTarget(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post reply.")) }
    );
  };

  const handleSaveEdit = (body: string, mentions: Mention[]) => {
    if (!editingComment) return;
    updateComment.mutate(
      { commentId: editingComment.id, body, mentions },
      { onSuccess: () => setEditingComment(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save changes.")) }
    );
  };

  const handleDelete = (comment: CommunityComment) => {
    const isRoot = comment.id === rootId;
    Alert.alert("Delete Comment", isRoot ? "Delete this comment and all its replies? This can't be undone." : "Delete this reply? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteComment.mutate(comment.id, {
            onSuccess: () => isRoot && goBack(),
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete comment.")),
          }),
      },
    ]);
  };

  const handleToggleLike = (comment: CommunityComment) => {
    if (!userId) return;
    toggleLike.mutate({ commentId: comment.id, userId, liked: !comment.likedByMe }, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update like.")) });
  };

  const card = (c: CommunityComment, variant: "root" | "reply") => (
    <CommentCard
      key={c.id}
      comment={c}
      variant={variant}
      isOwn={c.user_id === userId}
      viewerId={userId}
      highlighted={variant === "reply" && c.id === highlightedId}
      onReply={() => {
        setEditingComment(null);
        setReplyTarget({ id: c.id, name: c.profiles?.full_name ?? (variant === "root" ? "this comment" : "this reply") });
      }}
      onEdit={() => {
        setReplyTarget(null);
        setEditingComment(c);
      }}
      onDelete={() => handleDelete(c)}
      onReport={(reason) => handleReport(c, reason)}
      onBlock={() => handleBlock(c)}
      onToggleLike={() => handleToggleLike(c)}
      onOpenProfile={() => navigate(paths.player(c.user_id))}
      onShare={() => shareComment(rootId, variant === "root" ? undefined : c.id)}
    />
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--tabbar-h))] max-w-3xl flex-col lg:min-h-dvh lg:px-8 lg:pt-6">
      <PageHeader title="Comment" back backFallback={paths.community + "/chat"} />

      <div className="flex-1 p-4 pb-6 lg:px-0">
        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <Spinner />
          </div>
        ) : error || !root ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <p className="mb-2 text-base font-semibold text-ink">Couldn't load this comment</p>
            <p className="text-sm text-muted">{getFriendlyErrorMessage(error, "It may have been deleted.")}</p>
          </div>
        ) : (
          <>
            {card(root, "root")}
            {replies.map((r) => (
              <div key={r.id} className="ml-5 border-l-2 border-border pl-3">
                {card(r, "reply")}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-20 bg-surface lg:bottom-0">
        {replyTarget && !editingComment && (
          <div className="flex items-center justify-between bg-primary-light px-4 py-2">
            <span className="truncate text-xs font-medium text-primary">Replying to {replyTarget.name}</span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTarget(null)}>
              <Ionicon name="close" size={16} color={colors.primary} />
            </button>
          </div>
        )}
        {root && (
          <MentionComposer
            avatarName={profile?.full_name ?? null}
            avatarUrl={profile?.avatar ?? null}
            placeholder="Write a reply..."
            dropdownPosition="above"
            onSend={handleSend}
            sending={postComment.isPending}
            editing={editingComment ? { messageId: editingComment.id, initialBody: editingComment.body, initialMentions: editingComment.mentions } : null}
            onSave={handleSaveEdit}
            onCancelEdit={() => setEditingComment(null)}
            saving={updateComment.isPending}
          />
        )}
      </div>
    </div>
  );
}
