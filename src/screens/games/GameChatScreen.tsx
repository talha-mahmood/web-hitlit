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
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useGameMessages, useSendGameMessage } from "../../hooks/useGameMessages";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import { markGameChatRead, type GameMessage } from "../../lib/api/gameMessages";
import ChatIcon from "../../components/ChatIcon";

type ChatRoute = RouteProp<GamesStackParamList, "GameChat">;
type Nav = NativeStackNavigationProp<GamesStackParamList, "GameChat">;

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function MessageBubble({ message, isOwn }: { message: GameMessage; isOwn: boolean }) {
  const name = message.profiles?.full_name ?? "Player";
  const initials = name.charAt(0).toUpperCase();

  return (
    <View
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
    </View>
  );
}

export default function GameChatScreen() {
  const { params } = useRoute<ChatRoute>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const listRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState("");

  const { data: messages, isLoading, error } = useGameMessages(params.gameId);
  const sendMessage = useSendGameMessage(params.gameId);
  const qc = useQueryClient();

  // Marks the chat read on open, and again whenever a new message arrives
  // (via realtime) while this screen stays mounted — otherwise the unread
  // badge on GameDetailScreen would only clear the *next* time you open it.
  useEffect(() => {
    if (!userId || !messages || messages.length === 0) return;
    markGameChatRead(params.gameId, userId).then(() => {
      qc.invalidateQueries({ queryKey: ["gameChatUnread", params.gameId, userId] });
    });
  }, [params.gameId, userId, messages?.length, qc]);

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
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            {params.gameTitle ?? "Game Chat"}
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
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} isOwn={item.sender_id === userId} />}
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
          placeholder="Message the group..."
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
