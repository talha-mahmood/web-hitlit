import { useMemo, useState } from "react";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { useCommunityFeed, usePostComment, useUpdateComment, useDeleteComment, useToggleCommentLike } from "@app/hooks/useCommunityChat";
import { useCreatePoll } from "@app/hooks/usePolls";
import { useBlockedUserIds, useBlockUser, useReportMessage } from "@app/hooks/useModeration";
import type { CommunityComment } from "@app/lib/api/communityChat";
import type { Mention } from "@app/lib/mentionParser";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { shareComment } from "@app/lib/commentShareLink";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import { MentionComposer } from "@/components/chat/Mentions";
import { PollCreateModal } from "@/components/chat/Polls";
import CommentCard from "@/components/community/CommentCard";

// Port of CommunityChatContent: composer (with polls + emoji + @mentions) on
// top, a name/keyword search, then the live feed (realtime via the shared hook).
export default function CommunityChatContent({ onReply, onOpenProfile }: { onReply: (rootId: string) => void; onOpenProfile: (userId: string) => void }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);

  const { data: comments, isLoading, error } = useCommunityFeed(userId);
  const postComment = usePostComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();
  const createPoll = useCreatePoll();

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

  const visibleComments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = (comments ?? []).filter((c) => !blockedIds?.has(c.user_id));
    return q ? list.filter((c) => (c.profiles?.full_name ?? "").toLowerCase().includes(q) || c.body.toLowerCase().includes(q)) : list;
  }, [comments, searchQuery, blockedIds]);

  const handleSend = (body: string, mentions: Mention[]) => {
    if (!userId) return;
    postComment.mutate({ userId, body, mentions }, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post comment.")) });
  };

  const handleCreatePoll = (question: string, options: string[]) => {
    if (!userId) return;
    createPoll.mutate(
      { question, options, createdBy: userId },
      {
        onSuccess: (pollId) => {
          setPollModalOpen(false);
          postComment.mutate(
            { userId, body: `📊 ${question}`, pollId },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post the poll.")) }
          );
        },
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create the poll.")),
      }
    );
  };

  const handleSaveEdit = (body: string, mentions: Mention[]) => {
    if (!editingComment) return;
    updateComment.mutate(
      { commentId: editingComment.id, body, mentions },
      { onSuccess: () => setEditingComment(null), onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save changes.")) }
    );
  };

  const handleDelete = (comment: CommunityComment) =>
    Alert.alert("Delete Comment", "Delete this comment? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteComment.mutate(comment.id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete comment.")) }),
      },
    ]);

  const handleToggleLike = (comment: CommunityComment) => {
    if (!userId) return;
    toggleLike.mutate(
      { commentId: comment.id, userId, liked: !comment.likedByMe },
      { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update like.")) }
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="lg:card">
        <MentionComposer
          className="lg:rounded-2xl lg:border-b-0"
          avatarName={profile?.full_name ?? null}
          avatarUrl={profile?.avatar ?? null}
          placeholder="Start a conversation... "
          dropdownPosition="below"
          onSend={handleSend}
          sending={postComment.isPending}
          onPressPoll={() => setPollModalOpen(true)}
          editing={editingComment ? { messageId: editingComment.id, initialBody: editingComment.body, initialMentions: editingComment.mentions } : null}
          onSave={handleSaveEdit}
          onCancelEdit={() => setEditingComment(null)}
          saving={updateComment.isPending}
        />
      </div>

      <div className="bg-surface px-4 pt-2.5 lg:px-0 lg:pt-4">
        <FieldInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or keyword..."
          type="search"
          aria-label="Search comments"
          containerClassName="h-11 !rounded-3xl"
          className="!py-[11px] text-sm"
          left={<span className="mr-2"><Ionicon name="search-outline" size={18} color={colors.muted} /></span>}
          right={
            searchQuery.length > 0 ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")}>
                <Ionicon name="close-circle" size={18} color={colors.muted} />
              </button>
            ) : undefined
          }
        />
      </div>

      {isLoading ? (
        <div className="p-4 lg:px-0">
          <SkeletonCardRows />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <p className="mb-2 text-base font-semibold text-ink">Couldn't load comments</p>
          <p className="text-sm text-muted">{getFriendlyErrorMessage(error, "Please try again.")}</p>
        </div>
      ) : visibleComments.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Ionicon name="chatbubbles-outline" size={48} color={colors.border} />
          <p className="text-base font-semibold text-ink">{searchQuery.trim() ? `No comments match "${searchQuery.trim()}"` : "No comments yet"}</p>
          <p className="px-8 text-sm text-muted">{searchQuery.trim() ? "Try a different name or keyword." : "Be the first to say something to the community!"}</p>
        </div>
      ) : (
        <div className="p-4 pb-8 lg:px-0">
          {visibleComments.map((item) => (
            <CommentCard
              key={item.id}
              comment={item}
              variant="feed"
              isOwn={item.user_id === userId}
              viewerId={userId}
              onReply={() => onReply(item.id)}
              onEdit={() => {
                setEditingComment(item);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDelete={() => handleDelete(item)}
              onReport={(reason) => handleReport(item, reason)}
              onBlock={() => handleBlock(item)}
              onToggleLike={() => handleToggleLike(item)}
              onOpenProfile={() => onOpenProfile(item.user_id)}
              onShare={() => shareComment(item.id)}
            />
          ))}
        </div>
      )}

      <PollCreateModal open={pollModalOpen} onClose={() => setPollModalOpen(false)} onCreate={handleCreatePoll} creating={createPoll.isPending || postComment.isPending} />
    </div>
  );
}
