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
import { useBlockedUserIds, useBlockUser, useReportMessage } from "../../hooks/useModeration";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SquadsStackParamList } from "../../navigation/SquadsStackNavigator";
import { markSquadChatRead, type SquadMessage } from "../../lib/api/squadMessages";
import ChatIcon from "../../components/ChatIcon";

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

function MessageBubble({
  message,
  isOwn,
  onLongPress,
}: {
  message: SquadMessage;
  isOwn: boolean;
  onLongPress: () => void;
}) {
  const name = message.profiles?.full_name ?? "Member";
  const initials = name.charAt(0).toUpperCase();

  return (
    <Pressable
      onLongPress={isOwn ? undefined : onLongPress}
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
        >
          <Text className={isOwn ? "text-white text-sm" : "text-ink text-sm"}>{message.message}</Text>
        </View>
        <Text className={`text-muted text-xs mt-0.5 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
          {formatMessageTime(message.created_at)}
        </Text>
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

  const { data: allMessages, isLoading, error } = useSquadMessages(params.squadId);
  const sendMessage = useSendSquadMessage(params.squadId);
  const { data: blockedIds } = useBlockedUserIds(userId);
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(userId);
  const qc = useQueryClient();

  const messages = (allMessages ?? []).filter((m) => !blockedIds?.has(m.sender_id));

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
    sendMessage.mutate(
      { senderId: userId, message: text },
      {
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Could not send message.");
          setDraft(text);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-100"
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
            {error instanceof Error ? error.message : "Please try again."}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          className="flex-1"
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.sender_id === userId}
              onLongPress={() => {
                if (!userId) return;
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
                          Alert.alert("Error", err instanceof Error ? err.message : "Could not submit report."),
                      }
                    );
                  },
                  onBlock: () => {
                    blockUser.mutate(item.sender_id, {
                      onError: (err) =>
                        Alert.alert("Error", err instanceof Error ? err.message : "Could not block user."),
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
    </KeyboardAvoidingView>
  );
}
