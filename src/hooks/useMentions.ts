import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchMentionCandidates, mentionEntityExists } from "../lib/api/mentions";
import type { MentionEntityType } from "../lib/mentionParser";

// Same 300ms debounce convention InviteUsersModal already uses for its own
// live user search.
export function useMentionSearch(query: string, type: MentionEntityType | undefined) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return useQuery({
    queryKey: ["mentionCandidates", debounced, type ?? "all"],
    queryFn: () => searchMentionCandidates(debounced, type),
    enabled: debounced.trim().length > 0,
    staleTime: 15_000,
  });
}

export function useMentionEntityExists() {
  return async (entityType: MentionEntityType, entityId: string) => {
    try {
      return await mentionEntityExists(entityType, entityId);
    } catch {
      // A failed check should never block navigation outright — fail open
      // (treat as "exists") so a flaky network blip doesn't make every old
      // mention look broken; the destination screen's own not-found state
      // is the real backstop.
      return true;
    }
  };
}
