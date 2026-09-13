import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import {
  useCommentThread,
  usePostComment,
  useDeleteComment,
  useToggleCommentLike,
} from "../../hooks/useCommunityChat";
import type { CommunityComment } from "../../lib/api/communityChat";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";

type Route = RouteProp<CommunityStackParamList, "CommentThread">;
type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommentThread">;

function Avatar({ name, avatar, size = 36 }: { name: string | null; avatar: string | null; size?: number }) {
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

function CommentBubble({
  comment,
  isOwn,
  isRoot,
  onReply,
  onDelete,
  onToggleLike,
}: {
  comment: CommunityComment;
  isOwn: boolean;
  isRoot: boolean;
  onReply: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
}) {
  return (
    <View
      className={`rounded-2xl border p-3.5 mb-3 ${isRoot ? "bg-white border-border" : "bg-primary-light border-primary-light"}`}
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
          <View className="flex-row items-center mt-2.5" style={{ gap: 18 }}>
            <Pressable onPress={onToggleLike} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
              <Ionicons
                name={comment.likedByMe ? "heart" : "heart-outline"}
                size={17}
                color={comment.likedByMe ? colors.danger : colors.muted}
              />
              <Text className="text-muted text-xs font-medium">{comment.likeCount}</Text>
            </Pressable>
            <Pressable onPress={onReply} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
              <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} />
              <Text className="text-primary text-xs font-medium">Reply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CommentThreadScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: thread, isLoading, error } = useCommentThread(params.rootId, userId);
  const postComment = usePostComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();

  const root = thread?.find((c) => c.id === params.rootId);
  const replies = (thread ?? []).filter((c) => c.id !== params.rootId);

  const handlePost = () => {
    const body = draft.trim();
    if (!body || !userId) return;
    setDraft("");
    postComment.mutate(
      { userId, body, parentId: replyTarget?.id ?? params.rootId },
      {
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Could not post reply.");
          setDraft(body);
        },
      }
    );
  };

  const handleDelete = (comment: CommunityComment) => {
    const isDeletingRoot = comment.id === params.rootId;
    Alert.alert(
      "Delete Comment",
      isDeletingRoot
        ? "Delete this comment and all its replies? This can't be undone."
        : "Delete this reply? This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteComment.mutate(comment.id, {
              onSuccess: () => {
                if (isDeletingRoot) navigation.goBack();
              },
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Could not delete comment."),
            }),
        },
      ]
    );
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
    <KeyboardAvoidingView
      className="flex-1 bg-gray-100"
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <View
        className="flex-row items-center bg-primary px-4 pb-4"
        style={{ paddingTop: insets.top + 16, gap: 12 }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>
        <Text className="text-white font-extrabold text-lg flex-1">Comment</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : error || !root ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2">Couldn't load this comment</Text>
          <Text className="text-muted text-sm text-center">
            {error instanceof Error ? error.message : "It may have been deleted."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={replies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListHeaderComponent={
            <CommentBubble
              comment={root}
              isOwn={root.user_id === userId}
              isRoot
              onReply={() => setReplyTarget({ id: root.id, name: root.profiles?.full_name ?? "this comment" })}
              onDelete={() => handleDelete(root)}
              onToggleLike={() => handleToggleLike(root)}
            />
          }
          renderItem={({ item }) => (
            <View style={{ marginLeft: 20, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border }}>
              <CommentBubble
                comment={item}
                isOwn={item.user_id === userId}
                isRoot={false}
                onReply={() =>
                  setReplyTarget({ id: item.id, name: item.profiles?.full_name ?? "this reply" })
                }
                onDelete={() => handleDelete(item)}
                onToggleLike={() => handleToggleLike(item)}
              />
            </View>
          )}
        />
      )}

      {replyTarget && (
        <View className="flex-row items-center justify-between px-4 py-2 bg-primary-light">
          <Text className="text-primary text-xs font-medium" numberOfLines={1}>
            Replying to {replyTarget.name}
          </Text>
          <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.primary} />
          </Pressable>
        </View>
      )}

      <View
        className="flex-row items-center border-t border-border px-3 py-2 bg-white"
        style={{ paddingBottom: insets.bottom + 8, gap: 8 }}
      >
        <Avatar name={profile?.full_name ?? null} avatar={profile?.avatar ?? null} size={32} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a reply..."
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
    </KeyboardAvoidingView>
  );
}
