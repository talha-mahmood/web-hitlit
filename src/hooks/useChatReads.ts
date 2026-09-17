import { useQuery } from "@tanstack/react-query";
import { fetchSeenBy } from "../lib/api/chatReads";
import type { ChatKind } from "../lib/api/chatThreads";

// Powers the WhatsApp-style "Seen by" view opened by long-pressing your own
// message — only fetched on demand (enabled) since it's a one-off lookup
// shown in a modal, not something the main chat list needs continuously.
export function useSeenBy(
  kind: ChatKind,
  contextId: string,
  messageCreatedAt: string | undefined,
  senderId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["chatSeenBy", kind, contextId, messageCreatedAt],
    queryFn: () => fetchSeenBy(kind, contextId, messageCreatedAt as string, senderId),
    enabled: enabled && !!messageCreatedAt,
    staleTime: 0,
  });
}
