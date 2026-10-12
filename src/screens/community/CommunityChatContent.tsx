import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import FieldInput from "../../components/FieldInput";
import GradientFill from "../../components/GradientFill";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import {
  useCommunityFeed,
  usePostComment,
  useUpdateComment,
  useDeleteComment,
  useToggleCommentLike,
} from "../../hooks/useCommunityChat";
import type { CommunityComment } from "../../lib/api/communityChat";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import MentionComposer from "../../components/MentionComposer";
import MentionText from "../../components/MentionText";
import type { Mention } from "../../lib/mentionParser";
import { shareComment } from "../../lib/commentShareLink";
import PollCreateModal from "../../components/PollCreateModal";
import PollMessageCard from "../../components/PollMessageCard";
import { useCreatePoll } from "../../hooks/usePolls";

function Avatar({ name, avatar, size = 40 }: { name: string | null; avatar: string | null; size?: number }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-primary-light"
      />
    );
  }
  return (
    <GradientFill
      className="items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </GradientFill>
  );
}

function CommentCard({
  comment,
  isOwn,
  viewerId,
  onReply,
  onEdit,
  onDelete,
  onToggleLike,
  onOpenProfile,
}: {
  comment: CommunityComment;
  isOwn: boolean;
  viewerId: string | undefined;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onOpenProfile: () => void;
}) {
  const onShare = () => shareComment(comment.id);
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  const handleOpenMenu = () => {
    Alert.alert("Message Options", undefined, [
      { text: "Edit", onPress: onEdit },
      { text: "Delete", style: "destructive", onPress: onDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View className="bg-white rounded-2xl border border-border p-4 mb-3" style={cardShadow}>
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <Pressable onPress={onOpenProfile} hitSlop={4}>
          <Avatar name={comment.profiles?.full_name ?? null} avatar={comment.profiles?.avatar ?? null} />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={onOpenProfile} className="flex-1 mr-2">
              <Text className="text-ink font-bold text-sm" numberOfLines={1}>
                {comment.profiles?.full_name ?? "Player"}
              </Text>
            </Pressable>
            {isOwn && (
              <Pressable onPress={handleOpenMenu} hitSlop={8} className="p-1">
                <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Text className="text-muted text-xs mt-0.5">
            {formatCommunityTimeAgo(comment.created_at)}
            {isEdited ? " · Edited" : ""}
          </Text>
          {comment.poll_id ? (
            <View className="mt-2">
              <PollMessageCard pollId={comment.poll_id} fallbackQuestion={comment.body} viewerId={viewerId} fullWidth />
            </View>
          ) : (
            <MentionText body={comment.body} mentions={comment.mentions} className="text-ink text-sm mt-2" />
          )}
          <View className="flex-row items-center mt-3" style={{ gap: 18 }}>
            <Pressable onPress={onToggleLike} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={18}
                color={comment.likedByMe ? colors.danger : colors.muted}
              />
              <Text className="text-muted text-sm font-medium">{comment.likeCount}</Text>
            </Pressable>
            <Pressable onPress={onReply} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
              <Ionicons name="arrow-undo-outline" size={17} color={colors.primary} />
              <Text className="text-primary text-sm font-medium">Reply</Text>
            </Pressable>
            <Pressable onPress={onShare} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
              <Ionicons name="share-social-outline" size={17} color={colors.muted} />
              <Text className="text-muted text-sm font-medium">Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const DAY_FILTERS = [1, 2, 3] as const;

// Shared by the Community tab's in-place "Community Chat" segment — the
// composer + feed list, with no header of its own since the caller already
// provides one (the segmented pill row, for the in-place case).
export default function CommunityChatContent({
  onReply,
  onOpenProfile,
}: {
  onReply: (rootId: string) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  // null = no age filter (show everything the 6-month retention still has).
  const [dayFilter, setDayFilter] = useState<1 | 2 | 3 | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);

  const { data: comments, isLoading, error } = useCommunityFeed(userId);
  const postComment = usePostComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();
  const createPoll = useCreatePoll();

  // Everything's already loaded in one shot (no pagination on this feed), so
  // search is a plain client-side filter over the same array the day-age
  // filter already narrows — matches by the author's name or any keyword in
  // the comment body (e.g. "tournament", "games").
  const visibleComments = useMemo(() => {
    let list = comments ?? [];
    if (dayFilter) {
      const cutoff = Date.now() - dayFilter * 24 * 60 * 60 * 1000;
      list = list.filter((c) => new Date(c.created_at).getTime() >= cutoff);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => (c.profiles?.full_name ?? "").toLowerCase().includes(q) || c.body.toLowerCase().includes(q)
      );
    }
    return list;
  }, [comments, dayFilter, searchQuery]);

  const handleSend = (body: string, mentions: Mention[]) => {
    if (!userId) return;
    postComment.mutate(
      { userId, body, mentions },
      { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post comment.")) }
    );
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
      {
        onSuccess: () => setEditingComment(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save changes.")),
      }
    );
  };

  const handleDelete = (comment: CommunityComment) => {
    Alert.alert("Delete Comment", "Delete this comment? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteComment.mutate(comment.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete comment.")),
          }),
      },
    ]);
  };

  const handleToggleLike = (comment: CommunityComment) => {
    if (!userId) return;
    toggleLike.mutate(
      { commentId: comment.id, userId, liked: !comment.likedByMe },
      {
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update like.")),
      }
    );
  };

  return (
    <View className="flex-1">
      <MentionComposer
        avatarName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar ?? null}
        placeholder="Start a conversation... "
        dropdownPosition="below"
        onSend={handleSend}
        sending={postComment.isPending}
        onPressPoll={() => setPollModalOpen(true)}
        editing={
          editingComment
            ? { messageId: editingComment.id, initialBody: editingComment.body, initialMentions: editingComment.mentions }
            : null
        }
        onSave={handleSaveEdit}
        onCancelEdit={() => setEditingComment(null)}
        saving={updateComment.isPending}
      />

      <View className="px-4 pt-2.5 bg-white">
        <FieldInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or keyword..."
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ borderRadius: 24, height: 44 }}
          left={<Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
          right={
            searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <View className="flex-row items-center px-4 py-2.5 bg-white border-b border-border" style={{ gap: 8 }}>
        {DAY_FILTERS.map((d) => {
          const active = dayFilter === d;
          return (
            <Pressable key={d} onPress={() => setDayFilter(active ? null : d)}>
              {active ? (
                <GradientFill className="rounded-full px-3 py-1.5">
                  <Text className="text-xs font-bold text-white">
                    {d} Day{d === 1 ? "" : "s"}
                  </Text>
                </GradientFill>
              ) : (
                <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: "#F3F4F6" }}>
                  <Text className="text-xs font-bold text-muted">
                    {d} Day{d === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2">Couldn't load comments</Text>
          <Text className="text-muted text-sm text-center">
            {getFriendlyErrorMessage(error, "Please try again.")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleComments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">
                {searchQuery.trim()
                  ? `No comments match "${searchQuery.trim()}"`
                  : dayFilter
                    ? `No comments in the last ${dayFilter} day${dayFilter === 1 ? "" : "s"}`
                    : "No comments yet"}
              </Text>
              <Text className="text-muted text-sm text-center px-8">
                {searchQuery.trim()
                  ? "Try a different name or keyword."
                  : dayFilter
                    ? "Try a wider filter."
                    : "Be the first to say something to the community!"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CommentCard
              comment={item}
              isOwn={item.user_id === userId}
              viewerId={userId}
              onReply={() => onReply(item.id)}
              onEdit={() => setEditingComment(item)}
              onDelete={() => handleDelete(item)}
              onToggleLike={() => handleToggleLike(item)}
              onOpenProfile={() => onOpenProfile(item.user_id)}
            />
          )}
        />
      )}

      <PollCreateModal
        visible={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onCreate={handleCreatePoll}
        creating={createPoll.isPending || postComment.isPending}
      />
    </View>
  );
}
