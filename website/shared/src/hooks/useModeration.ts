import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockUser,
  fetchBlockedUserIds,
  fetchBlockedUsers,
  reportMessage,
  unblockUser,
} from "../lib/api/moderation";

export function useBlockedUserIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["blockedUserIds", userId],
    queryFn: () => fetchBlockedUserIds(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useBlockedUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ["blockedUsers", userId],
    queryFn: () => fetchBlockedUsers(userId as string),
    enabled: !!userId,
  });
}

export function useReportMessage() {
  return useMutation({ mutationFn: reportMessage });
}

export function useBlockUser(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockedId: string) => blockUser(userId as string, blockedId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blockedUserIds", userId] });
      qc.invalidateQueries({ queryKey: ["blockedUsers", userId] });
    },
  });
}

export function useUnblockUser(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockedId: string) => unblockUser(userId as string, blockedId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blockedUserIds", userId] });
      qc.invalidateQueries({ queryKey: ["blockedUsers", userId] });
    },
  });
}
