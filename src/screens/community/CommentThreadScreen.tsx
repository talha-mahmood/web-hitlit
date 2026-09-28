import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import {
  useCommentThread,
  usePostComment,
  useUpdateComment,
  useDeleteComment,
  useToggleCommentLike,
} from "../../hooks/useCommunityChat";
import type { CommunityComment } from "../../lib/api/communityChat";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import MentionComposer from "../../components/MentionComposer";
import MentionText from "../../components/MentionText";
import type { Mention } from "../../lib/mentionParser";

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
  onEdit,
  onDelete,
  onToggleLike,
  onOpenProfile,
}: {
  comment: CommunityComment;
  isOwn: boolean;
  isRoot: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onOpenProfile: () => void;
}) {
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;

  const handleOpenMenu = () => {
    Alert.alert("Message Options", undefined, [
      { text: "Edit", onPress: onEdit },
      { text: "Delete", style: "destructive", onPress: onDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View
      className={`rounded-2xl border p-3.5 mb-3 ${isRoot ? "bg-white border-border" : "bg-primary-light border-primary-light"}`}
    >
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
          <MentionText body={comment.body} mentions={comment.mentions} className="text-ink text-sm mt-2" />
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
  const isFocused = useIsFocused();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfileStore((s) => s.profile);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);

  const { data: thread, isLoading, error } = useCommentThread(params.rootId, userId);
  const postComment = usePostComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const toggleLike = useToggleCommentLike();

  const root = thread?.find((c) => c.id === params.rootId);
  const replies = (thread ?? []).filter((c) => c.id !== params.rootId);

  const handleSend = (body: string, mentions: Mention[]) => {
    if (!userId) return;
    postComment.mutate(
      { userId, body, mentions, parentId: replyTarget?.id ?? params.rootId },
      {
        onSuccess: () => setReplyTarget(null),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post reply.")),
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

  const startEdit = (comment: CommunityComment) => {
    setReplyTarget(null);
    setEditingComment(comment);
  };

  const startReply = (id: string, name: string) => {
    setEditingComment(null);
    setReplyTarget({ id, name });
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
                Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete comment.")),
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
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not update like.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      {isFocused ? <StatusBar style="light" /> : null}
      <View
        className="flex-row items-center px-4 pb-4"
        style={{ paddingTop: insets.top + 16, gap: 12, backgroundColor: "#14532D" }}
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
            {getFriendlyErrorMessage(error, "It may have been deleted.")}
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
              onReply={() => startReply(root.id, root.profiles?.full_name ?? "this comment")}
              onEdit={() => startEdit(root)}
              onDelete={() => handleDelete(root)}
              onToggleLike={() => handleToggleLike(root)}
              onOpenProfile={() => navigation.navigate("PlayerProfile", { userId: root.user_id })}
            />
          }
          renderItem={({ item }) => (
            <View style={{ marginLeft: 20, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border }}>
              <CommentBubble
                comment={item}
                isOwn={item.user_id === userId}
                isRoot={false}
                onReply={() => startReply(item.id, item.profiles?.full_name ?? "this reply")}
                onEdit={() => startEdit(item)}
                onDelete={() => handleDelete(item)}
                onToggleLike={() => handleToggleLike(item)}
                onOpenProfile={() => navigation.navigate("PlayerProfile", { userId: item.user_id })}
              />
            </View>
          )}
        />
      )}

      {replyTarget && !editingComment && (
        <View className="flex-row items-center justify-between px-4 py-2 bg-primary-light">
          <Text className="text-primary text-xs font-medium" numberOfLines={1}>
            Replying to {replyTarget.name}
          </Text>
          <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.primary} />
          </Pressable>
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <MentionComposer
          avatarName={profile?.full_name ?? null}
          avatarUrl={profile?.avatar ?? null}
          placeholder="Write a reply..."
          dropdownPosition="above"
          onSend={handleSend}
          sending={postComment.isPending}
          editing={
            editingComment
              ? { messageId: editingComment.id, initialBody: editingComment.body, initialMentions: editingComment.mentions }
              : null
          }
          onSave={handleSaveEdit}
          onCancelEdit={() => setEditingComment(null)}
          saving={updateComment.isPending}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
