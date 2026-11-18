import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { containsObjectionableContent } from "@app/lib/contentFilter";
import { useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { colors } from "@app/constants/theme";
import { useDeleteChatMessage } from "@app/hooks/useChatThread";
import { useSeenBy } from "@app/hooks/useChatReads";
import { useBlockedUserIds, useBlockUser, useReportMessage } from "@app/hooks/useModeration";
import { useCreatePoll } from "@app/hooks/usePolls";
import { useAuthStore } from "@app/store/authStore";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import { Ionicon } from "../icons/Icon";
import { Avatar } from "../ui/Avatar";
import Modal from "../ui/Modal";
import Spinner from "../ui/Spinner";
import { ChatIcon } from "../ui/Decor";
import { PollCreateModal, PollMessageCard } from "./Polls";

// The shape every chat (game / team / squad) shares.
export type ChatMessage = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  parent_id: string | null;
  poll_id: string | null;
  deleted_at: string | null;
  profiles: { full_name: string | null; avatar: string | null } | null;
};

type SendVars = { senderId: string; message: string; parentId?: string; pollId?: string };

const REPORT_REASONS = ["Spam", "Harassment or abuse", "Inappropriate content", "Other"];

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Long-press on touch, right-click with a mouse — the app's onLongPress.
function useLongPress(onTrigger: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onTrigger();
    },
    onTouchStart: () => {
      clear();
      timer.current = setTimeout(onTrigger, 500);
    },
    onTouchEnd: clear,
    onTouchMove: clear,
  };
}

function MessageBubble({
  m,
  isOwn,
  parent,
  highlighted,
  viewerId,
  fallbackName,
  onOptions,
  onReply,
  onDelete,
  onJumpToParent,
  onPressAvatar,
}: {
  m: ChatMessage;
  isOwn: boolean;
  parent: ChatMessage | null;
  highlighted: boolean;
  viewerId?: string;
  fallbackName: string;
  onOptions: () => void;
  onReply: () => void;
  onDelete: () => void;
  onJumpToParent: () => void;
  onPressAvatar: () => void;
}) {
  const name = m.profiles?.full_name ?? fallbackName;
  const deleted = !!m.deleted_at;
  const longPress = useLongPress(onOptions);
  return (
    <div id={`msg-${m.id}`} className={`group flex gap-2 px-4 py-1.5 ${isOwn ? "justify-end" : "justify-start"}`} {...(deleted ? {} : longPress)}>
      {!isOwn && (
        <div className="relative shrink-0">
          <button type="button" onClick={onPressAvatar} aria-label={`Open ${name}'s profile`}>
            <Avatar url={m.profiles?.avatar} name={name} size={44} />
          </button>
          <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-white bg-[#22C55E]" />
        </div>
      )}
      <div className="max-w-[75%] lg:max-w-[60%]">
        {!isOwn && <p className="mb-1 ml-1 text-sm font-bold text-ink">{name}</p>}
        <div className="relative">
          {!deleted && m.poll_id ? (
            <PollMessageCard pollId={m.poll_id} fallbackQuestion={m.message} viewerId={viewerId} />
          ) : (
            <div className={`rounded-2xl px-3 py-2 ${isOwn ? "bg-brand" : "bg-gray-100"} ${highlighted ? "ring-2 ring-warning" : ""}`}>
              {deleted ? (
                <p className={`text-sm italic ${isOwn ? "text-white/80" : "text-muted"}`}>This message was deleted</p>
              ) : (
                <>
                  {parent && (
                    <button
                      type="button"
                      onClick={onJumpToParent}
                      className={`mb-1 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left ${isOwn ? "border-white bg-white/[0.18]" : "border-primary bg-black/5"}`}
                    >
                      <span className={`block truncate text-xs font-semibold ${isOwn ? "text-white" : "text-primary"}`}>{parent.profiles?.full_name ?? fallbackName}</span>
                      <span className={`block truncate text-xs ${isOwn ? "text-white/80" : "text-muted"} ${parent.deleted_at ? "italic" : ""}`}>
                        {parent.deleted_at ? "This message was deleted" : parent.message}
                      </span>
                    </button>
                  )}
                  <p className={`whitespace-pre-wrap break-words text-sm ${isOwn ? "text-white" : "text-ink"}`}>{m.message}</p>
                </>
              )}
            </div>
          )}
          {isOwn && !deleted && (
            <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow-card">
              <Ionicon name="checkmark-done" size={12} color={colors.primary} />
            </span>
          )}
        </div>
        {!deleted && (
          <div className={`mt-1 flex items-center gap-3 text-xs ${isOwn ? "mr-1 justify-end" : "ml-1"}`}>
            <span className="text-muted">{formatMessageTime(m.created_at)}</span>
            <button type="button" onClick={onReply} className="font-medium text-primary hover:underline">
              Reply
            </button>
            {isOwn && (
              <button type="button" onClick={onDelete} aria-label="Delete message">
                <Ionicon name="trash-outline" size={13} color={colors.muted} />
              </button>
            )}
            <button type="button" onClick={onOptions} aria-label={isOwn ? "Seen by" : "Message options"} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100">
              <Ionicon name={isOwn ? "eye-outline" : "ellipsis-horizontal"} size={14} color={colors.muted} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Port of the app's GameChatScreen / TeamChatScreen / SquadChatScreen (the
// three are identical apart from labels and data source): live messages,
// replies with jump-to-original, polls, delete own, "Seen by" on
// your own messages, report / block on others', blocked users hidden,
// marks the chat read for the unread badge.
export default function ChatRoom({
  kind,
  contextId,
  title,
  subtitle,
  subtitleIcon,
  watermarkIcon,
  placeholder,
  emptyText,
  fallbackName,
  reportSource,
  messagesQuery,
  send,
  markRead,
  unreadKey,
  backFallback,
}: {
  kind: "game" | "team" | "squad" | "event";
  contextId: string;
  title: string;
  subtitle?: string;
  subtitleIcon?: ReactNode;
  watermarkIcon?: ReactNode;
  placeholder: string;
  emptyText: string;
  fallbackName: string;
  reportSource: "game_message" | "team_message" | "squad_message" | "event_message";
  messagesQuery: UseQueryResult<ChatMessage[]>;
  send: UseMutationResult<unknown, Error, SendVars>;
  markRead: (contextId: string, userId: string) => Promise<void>;
  unreadKey: string;
  backFallback: string;
}) {
  const navigate = useAppNavigate();
  const goBack = useGoBack(backFallback);
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const listEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [pollOpen, setPollOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [seenByTarget, setSeenByTarget] = useState<ChatMessage | null>(null);

  const { data: all, isLoading, error } = messagesQuery;
  const createPoll = useCreatePoll();
  const { data: blockedIds } = useBlockedUserIds(userId);
  const reportMessage = useReportMessage();
  const blockUser = useBlockUser(userId);
  const deleteMessage = useDeleteChatMessage(kind, contextId);
  const messages = (all ?? []).filter((m) => !blockedIds?.has(m.sender_id));
  const { data: seenBy, isLoading: seenByLoading } = useSeenBy(kind, contextId, seenByTarget?.created_at, seenByTarget?.sender_id ?? "", !!seenByTarget);

  // Keep pinned to the newest message.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    markRead(contextId, userId).then(() => qc.invalidateQueries({ queryKey: [unreadKey, contextId, userId] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, userId, messages.length]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !userId) return;
    if (containsObjectionableContent(text)) {
      Alert.alert("Message not sent", "Your message contains language that violates our community guidelines.");
      return;
    }
    setDraft("");
    const parentId = replyTarget?.id;
    setReplyTarget(null);
    send.mutate(
      { senderId: userId, message: text, parentId },
      {
        onError: (err) => {
          Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send message."));
          setDraft(text);
        },
      }
    );
  };

  const jumpTo = (parentId: string) => {
    const el = document.getElementById(`msg-${parentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(parentId);
    setTimeout(() => setHighlightedId((cur) => (cur === parentId ? null : cur)), 1500);
  };

  const showActions = (m: ChatMessage) => {
    if (!userId) return;
    if (m.sender_id === userId) {
      setSeenByTarget(m);
      return;
    }
    const name = m.profiles?.full_name ?? `this ${fallbackName.toLowerCase()}`;
    Alert.alert("Message options", undefined, [
      {
        text: "Report message",
        onPress: () =>
          Alert.alert(
            "Report message",
            "Why are you reporting this?",
            REPORT_REASONS.map((reason) => ({
              text: reason,
              onPress: () =>
                reportMessage.mutate(
                  { reporterId: userId, reportedUserId: m.sender_id, source: reportSource, sourceId: m.id, contextId, messageSnapshot: m.message, reason },
                  {
                    onSuccess: () => Alert.alert("Reported", "Thanks — we'll review this message."),
                    onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not submit report.")),
                  }
                ),
            }))
          ),
      },
      {
        text: `Block ${name}`,
        style: "destructive",
        onPress: () =>
          Alert.alert(`Block ${name}?`, "You won't see their messages in chat anymore.", [
            { text: "Cancel", style: "cancel" },
            { text: "Block", style: "destructive", onPress: () => blockUser.mutate(m.sender_id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not block user.")) }) },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!draft.trim() && !send.isPending;

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-var(--tabbar-h)-env(safe-area-inset-bottom))] max-w-4xl flex-col overflow-hidden bg-surface lg:h-dvh lg:px-8 lg:pt-6">
      {watermarkIcon}
      <div className="relative flex items-center px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-0">
        <button type="button" onClick={goBack} aria-label="Back" className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card hover:bg-gray-50">
          <Ionicon name="arrow-back" size={20} color={colors.ink} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[21px] font-extrabold text-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-1 flex items-center gap-[5px] truncate text-sm font-semibold text-ink">
              {subtitleIcon}
              <span className="truncate">{subtitle}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="mb-2 text-base font-semibold text-ink">Couldn't load chat</p>
            <p className="text-sm text-muted">{getFriendlyErrorMessage(error, "Please try again.")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary-light">
              <ChatIcon size={40} />
            </span>
            <p className="text-sm text-muted">{emptyText}</p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              isOwn={m.sender_id === userId}
              parent={m.parent_id ? (messages.find((x) => x.id === m.parent_id) ?? null) : null}
              highlighted={m.id === highlightedId}
              viewerId={userId}
              fallbackName={fallbackName}
              onOptions={() => showActions(m)}
              onReply={() => {
                setReplyTarget(m);
                inputRef.current?.focus();
              }}
              onDelete={() =>
                Alert.alert("Delete Message", "Delete this message? This can't be undone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteMessage.mutate(m.id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not delete message.")) }) },
                ])
              }
              onJumpToParent={() => m.parent_id && jumpTo(m.parent_id)}
              onPressAvatar={() => navigate(paths.player(m.sender_id))}
            />
          ))
        )}
        <div ref={listEnd} />
      </div>

      {replyTarget && (
        <div className="relative flex items-center justify-between border-t border-border bg-primary-light px-4 py-2">
          <div className="mr-2 min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary">Replying to {replyTarget.profiles?.full_name ?? fallbackName}</p>
            <p className="truncate text-xs text-muted">{replyTarget.message}</p>
          </div>
          <button type="button" aria-label="Cancel reply" onClick={() => setReplyTarget(null)}>
            <Ionicon name="close" size={18} color={colors.primary} />
          </button>
        </div>
      )}

      <div className="relative flex items-end gap-2 rounded-t-[22px] bg-surface px-3 py-2.5 shadow-card lg:mb-4 lg:rounded-[22px] lg:border lg:border-border">
        <button type="button" onClick={() => setPollOpen(true)} aria-label="Create poll" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light hover:brightness-95">
          <Ionicon name="bar-chart-outline" size={19} color={colors.primary} />
        </button>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={500}
          rows={1}
          className="block max-h-[140px] min-h-[42px] min-w-0 flex-1 resize-none rounded-2xl border border-border px-4 py-2.5 text-ink outline-none placeholder:text-muted focus:border-primary"
        />
        <button type="button" onClick={handleSend} disabled={!canSend} aria-label="Send" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${canSend ? "press bg-brand shadow-card" : "bg-gray-200"}`}>
          <Ionicon name="send" size={17} color="white" />
        </button>
      </div>

      <Modal open={!!seenByTarget} onClose={() => setSeenByTarget(null)} title="Seen By">
        {seenByLoading ? (
          <div className="my-6 flex justify-center">
            <Spinner />
          </div>
        ) : (seenBy ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No one has seen this message yet.</p>
        ) : (
          (seenBy ?? []).map((u) => (
            <button key={u.userId} type="button" onClick={() => navigate(paths.player(u.userId))} className="flex w-full items-center gap-2.5 py-2.5 text-left">
              <Avatar url={u.avatar} name={u.fullName} size={36} />
              <span className="flex-1 truncate text-sm font-medium text-ink">{u.fullName ?? "Player"}</span>
              <span className="text-xs text-muted">{formatMessageTime(u.lastReadAt)}</span>
            </button>
          ))
        )}
      </Modal>

      <PollCreateModal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        creating={createPoll.isPending || send.isPending}
        onCreate={(question, options) => {
          if (!userId) return;
          createPoll.mutate(
            { question, options, createdBy: userId },
            {
              onSuccess: (pollId) => {
                setPollOpen(false);
                send.mutate({ senderId: userId, message: `📊 ${question}`, pollId }, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not post the poll.")) });
              },
              onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not create the poll.")),
            }
          );
        }}
      />
    </div>
  );
}
