import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  fetchEvents,
  fetchEventDetail,
  createEvent,
  updateEvent,
  setEventJoinBlocked,
  joinEvent,
  leaveEvent,
  disbandEvent,
  approveMember,
  rejectMember,
  removeMember,
  setMemberHost,
} from "../lib/api/events";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";

export function useEvents(filters: { search?: string } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["events", filters],
    queryFn: () => fetchEvents(filters),
    staleTime: 30_000,
    // See useGames' identical comment — same filter-change flash otherwise.
    placeholderData: keepPreviousData,
  });

  // An event being created or disbanded should show up (or disappear)
  // immediately for anyone browsing — without this the list only updates
  // on pull-to-refresh or the 30s staleTime.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("events:list"))
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useEventDetail(eventId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEventDetail(eventId),
    staleTime: 30_000,
    retry: 1,
  });

  // A join request, approval, the event itself being edited/disbanded, etc.
  // — all row changes made by someone else's device. Without this the
  // viewer only sees it after manually leaving and re-entering the screen.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName(`event_members:${eventId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_members", filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event", eventId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event", eventId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  return query;
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateEvent,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["event", data.id] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSetEventJoinBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, blocked }: { eventId: string; blocked: boolean }) => setEventJoinBlocked(eventId, blocked),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event", vars.eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useJoinEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId, location }: { eventId: string; userId: string; location: string }) =>
      joinEvent(eventId, userId, location),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event", vars.eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useLeaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) => leaveEvent(eventId, userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["event", vars.eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDisbandEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => disbandEvent(eventId),
    onSuccess: (_, eventId) => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useApproveMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventMemberId: string) => approveMember(eventMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useRejectMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventMemberId: string) => rejectMember(eventMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });
}

export function useRemoveMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventMemberId: string) => removeMember(eventMemberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSetMemberHost(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventMemberId, isHost }: { eventMemberId: string; isHost: boolean }) =>
      setMemberHost(eventMemberId, isHost),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });
}
