import { useMemo, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import {
  useCommunityFeed,
  usePostComment,
  useDeleteComment,
  useToggleCommentLike,
} from "../../hooks/useCommunityChat";
import type { CommunityComment } from "../../lib/api/communityChat";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

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
    <View
      className="bg-primary items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </View>
  );
}

function CommentCard({
  comment,
  isOwn,
  onReply,
  onDelete,
  onToggleLike,
  onOpenProfile,
}: {
  comment: CommunityComment;
  isOwn: boolean;
  onReply: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onOpenProfile: () => void;
}) {
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
              <Pressable onPress={onDelete} hitSlop={8} className="p-1">
                <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Text className="text-muted text-xs mt-0.5">{formatCommunityTimeAgo(comment.created_at)}</Text>
          <Text className="text-ink text-sm mt-2">{comment.body}</Text>
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
  const [draft, setDraft] = useState("");
  // null = no age filter (show everything the 6-month retention still has).
  const [dayFilter, setDayFilter] = useState<1 | 2 | 3 | null>(null);

  const { data: comments, isLoading, error } = useCommunityFeed(userId);
  const postComment = usePostComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();

  const visibleComments = useMemo(() => {
    if (!dayFilter) return comments ?? [];
    const cutoff = Date.now() - dayFilter * 24 * 60 * 60 * 1000;
    return (comments ?? []).filter((c) => new Date(c.created_at).getTime() >= cutoff);
  }, [comments, dayFilter]);

  const handlePost = () => {
    const body = draft.trim();
    if (!body || !userId) return;
    setDraft("");
    postComment.mutate(
      { userId, body },
      {
        onError: (err) => {
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post comment."));
          setDraft(body);
        },
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
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-border" style={{ gap: 8 }}>
        <Avatar name={profile?.full_name ?? null} avatar={profile?.avatar ?? null} size={32} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Start a conversation... "
          className="flex-1 border border-border rounded-full px-4 py-2.5 text-ink"
          maxLength={1000}
          multiline
        />
        <Pressable
          onPress={handlePost}
          disabled={!draft.trim() || postComment.isPending}
          className={`w-10 h-10 rounded-full items-center justify-center ${draft.trim() ? "bg-primary" : "bg-gray-200"}`}
        >
          <Ionicons name="send" size={16} color="white" />
        </Pressable>
      </View>

      <View className="flex-row items-center px-4 py-2.5 bg-white border-b border-border" style={{ gap: 8 }}>
        {DAY_FILTERS.map((d) => {
          const active = dayFilter === d;
          return (
            <Pressable
              key={d}
              onPress={() => setDayFilter(active ? null : d)}
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: active ? colors.primary : "#F3F4F6" }}
            >
              <Text className={`text-xs font-bold ${active ? "text-white" : "text-muted"}`}>
                {d} Day{d === 1 ? "" : "s"}
              </Text>
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
                {dayFilter ? `No comments in the last ${dayFilter} day${dayFilter === 1 ? "" : "s"}` : "No comments yet"}
              </Text>
              <Text className="text-muted text-sm text-center px-8">
                {dayFilter ? "Try a wider filter." : "Be the first to say something to the community!"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CommentCard
              comment={item}
              isOwn={item.user_id === userId}
              onReply={() => onReply(item.id)}
              onDelete={() => handleDelete(item)}
              onToggleLike={() => handleToggleLike(item)}
              onOpenProfile={() => onOpenProfile(item.user_id)}
            />
          )}
        />
      )}
    </View>
  );
}
