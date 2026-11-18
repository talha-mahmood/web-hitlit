import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteChatMessage, type ChatKind } from "../lib/api/chatThreads";

// Shared with the main chat list's own invalidation so a delete made here
// is reflected there too — though since delete is now a soft update
// (deleted_at, picked up live via realtime), this mostly just covers any
// screen that isn't currently mounted/subscribed.
const LIST_QUERY_KEY: Record<ChatKind, string> = {
  game: "gameMessages",
  team: "teamMessages",
  squad: "squadMessages",
  event: "eventMessages",
};

export function useDeleteChatMessage(kind: ChatKind, contextId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteChatMessage(kind, messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST_QUERY_KEY[kind], contextId] });
    },
  });
}
