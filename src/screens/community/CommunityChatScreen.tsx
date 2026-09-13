import { useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityChat">;

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
}: {
  comment: CommunityComment;
  isOwn: boolean;
  onReply: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
}) {
  return (
    <View
      className="bg-white rounded-2xl border border-border p-4 mb-3"
      style={cardShadow}
    >
      <View className="flex-row items-start" style={{ gap: 10 }}>
        <Avatar name={comment.profiles?.full_name ?? null} avatar={comment.profiles?.avatar ?? null} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-ink font-bold text-sm" numberOfLines={1}>
              {comment.profiles?.full_name ?? "Player"}
            </Text>
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

export default function CommunityChatScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const [draft, setDraft] = useState("");

  const { data: comments, isLoading, error } = useCommunityFeed(userId);
  const postComment = usePostComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();

  const handlePost = () => {
    const body = draft.trim();
    if (!body || !userId) return;
    setDraft("");
    postComment.mutate(
      { userId, body },
      {
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Could not post comment.");
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
            onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not delete comment."),
          }),
      },
    ]);
  };

  const handleToggleLike = (comment: CommunityComment) => {
    if (!userId) return;
    toggleLike.mutate(
      { commentId: comment.id, userId, liked: !comment.likedByMe },
      {
        onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not update like."),
      }
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="bg-primary px-5 pb-6"
        style={{
          paddingTop: insets.top + 16,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View className="bg-white/20 rounded-2xl items-center justify-center" style={{ width: 44, height: 44 }}>
            <Ionicons name="people" size={22} color="white" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-extrabold text-xl">Community Chat</Text>
            <Text className="text-white text-xs mt-0.5" style={{ opacity: 0.85 }}>
              Share your thoughts, ask questions, connect with the community!
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center px-4 py-3 bg-white border-b border-border" style={{ gap: 8 }}>
        <Avatar name={profile?.full_name ?? null} avatar={profile?.avatar ?? null} size={32} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment..."
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

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2">Couldn't load comments</Text>
          <Text className="text-muted text-sm text-center">
            {error instanceof Error ? error.message : "Please try again."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={comments ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">No comments yet</Text>
              <Text className="text-muted text-sm text-center px-8">
                Be the first to say something to the community!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CommentCard
              comment={item}
              isOwn={item.user_id === userId}
              onReply={() => navigation.navigate("CommentThread", { rootId: item.id })}
              onDelete={() => handleDelete(item)}
              onToggleLike={() => handleToggleLike(item)}
            />
          )}
        />
      )}
    </View>
  );
}
