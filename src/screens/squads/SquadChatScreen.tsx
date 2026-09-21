import { useEffect, useRef, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useSquadMessages, useSendSquadMessage } from "../../hooks/useSquadMessages";
import { useDeleteChatMessage } from "../../hooks/useChatThread";
import { useSeenBy } from "../../hooks/useChatReads";
import { useBlockedUserIds, useBlockUser, useReportMessage } from "../../hooks/useModeration";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import { markSquadChatRead, type SquadMessage } from "../../lib/api/squadMessages";
import ChatIcon from "../../components/ChatIcon";
import SeenByModal from "../../components/SeenByModal";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

const REPORT_REASONS = ["Spam", "Harassment or abuse", "Inappropriate content", "Other"];

// Long-press on someone else's message to report it or block them going
// forward — required by App Store guideline 1.2 for apps with user-to-user
// chat. Reporting flags the message for admin review without removing it for
// anyone; blocking only hides that sender's messages from your own view.
function showMessageActions(opts: {
  message: SquadMessage;
  squadId: string;
  userId: string;
  onReport: (reason: string) => void;
  onBlock: () => void;
}) {
  const name = opts.message.profiles?.full_name ?? "this member";
  Alert.alert("Message options", undefined, [
    {
      text: "Report message",
      onPress: () => {
        Alert.alert(
          "Report message",
          "Why are you reporting this?",
          REPORT_REASONS.map((reason) => ({ text: reason, onPress: () => opts.onReport(reason) }))
        );
      },
    },
    {
      text: `Block ${name}`,
      style: "destructive",
      onPress: () => {
        Alert.alert(`Block ${name}?`, "You won't see their messages in chat anymore.", [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: opts.onBlock },
        ]);
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}

type ChatRoute = RouteProp<SquadsStackParamList, "SquadChat">;
type Nav = NativeStackNavigationProp<SquadsStackParamList, "SquadChat">;

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// The small quoted box WhatsApp shows above a reply — tapping it jumps back
// to the original message. If that message has since been deleted, the
// quote shows the same placeholder the deleted message itself does.
function QuotedPreview({ parent, isOwn, onPress }: { parent: SquadMessage; isOwn: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg px-2.5 py-1.5 mb-1"
      style={{ backgroundColor: isOwn ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)", borderLeftWidth: 3, borderLeftColor: isOwn ? "white" : colors.primary }}
    >
      <Text className={`text-xs font-semibold ${isOwn ? "text-white" : "text-primary"}`} numberOfLines={1}>
        {parent.profiles?.full_name ?? "Member"}
      </Text>
      <Text className={`text-xs ${isOwn ? "text-white/80" : "text-muted"}`} numberOfLines={1} style={parent.deleted_at ? { fontStyle: "italic" } : undefined}>
        {parent.deleted_at ? "This message was deleted" : parent.message}
      </Text>
    </Pressable>
  );
}

function MessageBubble({
  message,
  isOwn,
  parent,
  isHighlighted,
  onLongPress,
  onReply,
  onDelete,
  onJumpToParent,
}: {
  message: SquadMessage;
  isOwn: boolean;
  parent: SquadMessage | null;
  isHighlighted: boolean;
  onLongPress: () => void;
  onReply: () => void;
  onDelete: () => void;
  onJumpToParent: () => void;
}) {
  const name = message.profiles?.full_name ?? "Member";
  const initials = name.charAt(0).toUpperCase();
  const isDeleted = !!message.deleted_at;

  return (
    <Pressable
      onLongPress={isDeleted ? undefined : onLongPress}
      className={`flex-row px-4 py-1.5 ${isOwn ? "justify-end" : "justify-start"}`}
      style={{ gap: 8 }}
    >
      {!isOwn &&
        (message.profiles?.avatar ? (
          <Image source={{ uri: message.profiles.avatar }} className="w-7 h-7 rounded-full bg-primary-light" />
        ) : (
          <View className="w-7 h-7 rounded-full bg-primary-light items-center justify-center">
            <Text className="text-primary font-bold text-xs">{initials}</Text>
          </View>
        ))}
      <View style={{ maxWidth: "75%" }}>
        {!isOwn && <Text className="text-muted text-xs mb-0.5 ml-1">{name}</Text>}
        <View
          className={`px-3 py-2 rounded-2xl ${isOwn ? "bg-primary rounded-br-sm" : "bg-gray-100 rounded-bl-sm"}`}
          style={isHighlighted ? { borderWidth: 2, borderColor: colors.warning ?? "#F59E0B" } : undefined}
        >
          {isDeleted ? (
            <Text
              className={`text-sm ${isOwn ? "text-white/80" : "text-muted"}`}
              style={{ fontStyle: "italic" }}
            >
              This message was deleted
            </Text>
          ) : (
            <>
              {parent && <QuotedPreview parent={parent} isOwn={isOwn} onPress={onJumpToParent} />}
              <Text className={isOwn ? "text-white text-sm" : "text-ink text-sm"}>{message.message}</Text>
            </>
          )}
        </View>
        {!isDeleted && (
          <View className={`flex-row items-center mt-1 ${isOwn ? "justify-end mr-1" : "ml-1"}`} style={{ gap: 12 }}>
            <Text className="text-muted text-xs">{formatMessageTime(message.created_at)}</Text>
            <Pressable onPress={onReply} hitSlop={8}>
              <Text className="text-primary text-xs font-medium">Reply</Text>
            </Pressable>
            {isOwn && (
              <Pressable onPress={onDelete} hitSlop={8}>
                <Ionicons name="trash-outline" size={13} color={colors.muted} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function SquadChatScreen() {
  const { params } = useRoute<ChatRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const listRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<SquadMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [seenByTarget, setSeenByTarget] = useState<SquadMessage | null>(null);

  const { data: allMessages, isLoading, error } = useSquadMessages(params.squadId);
  const sendMessage = useSendSquadMessage(params.squadId);
  const { data: blockedIds } = useBlockedUserIds(userId);
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(userId);
  const qc = useQueryClient();

  const messages = (allMessages ?? []).filter((m) => !blockedIds?.has(m.sender_id));
  const deleteMessage = useDeleteChatMessage("squad", params.squadId);
  const { data: seenBy, isLoading: seenByLoading } = useSeenBy(
    "squad",
    params.squadId,
    seenByTarget?.created_at,
    seenByTarget?.sender_id ?? "",
    !!seenByTarget
  );

  const handleDelete = (message: SquadMessage) => {
    Alert.alert("Delete Message", "Delete this message? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteMessage.mutate(message.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete message.")),
          }),
      },
    ]);
  };

  // FlatList can't jump straight to an index it hasn't measured yet (common
  // for a message further up an active chat) — scrollToIndex then just
  // throws instead of scrolling. onScrollToIndexFailed's job is to recover:
  // jump to the estimated offset first (forcing those rows to render/
  // measure), then retry the precise scroll once they have. Briefly
  // highlighting the landed-on message (like WhatsApp) makes it obvious
  // which one it jumped to, since it's easy to lose track of a scroll.
  const handleJumpToParent = (parentId: string) => {
    const index = messages.findIndex((m) => m.id === parentId);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setHighlightedId(parentId);
    setTimeout(() => setHighlightedId((cur) => (cur === parentId ? null : cur)), 1500);
  };

  const handleScrollToIndexFailed = (info: { index: number; averageItemLength: number }) => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
    }, 100);
  };

  // Marks the chat read on open, and again whenever a new message arrives
  // (via realtime) while this screen stays mounted — otherwise the unread
  // badge on SquadDetailScreen would only clear the *next* time you open it.
  useEffect(() => {
    if (!userId || !messages || messages.length === 0) return;
    markSquadChatRead(params.squadId, userId).then(() => {
      qc.invalidateQueries({ queryKey: ["squadChatUnread", params.squadId, userId] });
    });
  }, [params.squadId, userId, messages?.length, qc]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft("");
    const parentId = replyTarget?.id;
    setReplyTarget(null);
    sendMessage.mutate(
      { senderId: userId, message: text, parentId },
      {
        onError: (err) => {
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send message."));
          setDraft(text);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-green-50"
      // "height" was never actually proven to work for this layout — every
      // other Android screen using it (CreateSquadScreen, etc.) has no fixed
      // bottom bar; their bottom action lives in the header. This screen's
      // composer is a fixed sibling below the FlatList, so it needs "padding"
      // (pushes the whole column, composer included, up together) on both
      // platforms rather than a height recalculation.
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {params.squadName ?? "Squad Chat"}
          </Text>
          <Text className="text-muted text-xs">Messages disappear after 24 hours</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink font-semibold text-base mb-2">Couldn't load chat</Text>
          <Text className="text-muted text-sm text-center">
            {getFriendlyErrorMessage(error, "Please try again.")}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          className="flex-1"
          data={messages}
          keyExtractor={(m) => m.id}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.sender_id === userId}
              parent={item.parent_id ? (messages.find((m) => m.id === item.parent_id) ?? null) : null}
              isHighlighted={item.id === highlightedId}
              onReply={() => setReplyTarget(item)}
              onDelete={() => handleDelete(item)}
              onJumpToParent={() => item.parent_id && handleJumpToParent(item.parent_id)}
              onLongPress={() => {
                if (!userId) return;
                if (item.sender_id === userId) {
                  setSeenByTarget(item);
                  return;
                }
                showMessageActions({
                  message: item,
                  squadId: params.squadId,
                  userId,
                  onReport: (reason) => {
                    reportMessage.mutate(
                      {
                        reporterId: userId,
                        reportedUserId: item.sender_id,
                        source: "squad_message",
                        sourceId: item.id,
                        contextId: params.squadId,
                        messageSnapshot: item.message,
                        reason,
                      },
                      {
                        onSuccess: () => Alert.alert("Reported", "Thanks — we'll review this message."),
                        onError: (err) =>
                          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not submit report.")),
                      }
                    );
                  },
                  onBlock: () => {
                    blockUser.mutate(item.sender_id, {
                      onError: (err) =>
                        Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block user.")),
                    });
                  },
                });
              }}
            />
          )}
          contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6">
              <View
                className="items-center justify-center rounded-full mb-3"
                style={{ width: 88, height: 88, backgroundColor: colors.primaryLight }}
              >
                <ChatIcon size={40} />
              </View>
              <Text className="text-muted text-sm text-center">
                No messages yet. Say hi to the squad!
              </Text>
            </View>
          }
        />
      )}

      {/* Reply preview — cleared on send or dismissed manually. */}
      {replyTarget && (
        <View className="flex-row items-center justify-between px-4 py-2 border-t border-border bg-primary-light">
          <View className="flex-1 mr-2">
            <Text className="text-primary text-xs font-semibold" numberOfLines={1}>
              Replying to {replyTarget.profiles?.full_name ?? "Member"}
            </Text>
            <Text className="text-muted text-xs" numberOfLines={1}>
              {replyTarget.message}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.primary} />
          </Pressable>
        </View>
      )}

      {/* Composer */}
      <View
        className="flex-row items-center border-t border-border px-3 py-2"
        style={{ paddingBottom: insets.bottom + 8, gap: 8 }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the squad..."
          className="flex-1 border border-border rounded-full px-4 py-2.5 text-ink"
          maxLength={500}
          multiline
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || sendMessage.isPending}
          className={`w-10 h-10 rounded-full items-center justify-center ${draft.trim() ? "bg-primary" : "bg-gray-200"}`}
        >
          <Ionicons name="send" size={16} color="white" />
        </Pressable>
      </View>

      <SeenByModal
        visible={!!seenByTarget}
        onClose={() => setSeenByTarget(null)}
        seenBy={seenBy ?? []}
        isLoading={seenByLoading}
      />
    </KeyboardAvoidingView>
  );
}
