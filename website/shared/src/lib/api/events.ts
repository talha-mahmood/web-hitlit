import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventMemberRow = Database["public"]["Tables"]["event_members"]["Row"];

export type EventListItem = EventRow & {
  profiles: {
    id: string;
    full_name: string | null;
    avatar: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  event_members: {
    id: string;
    status: EventMemberRow["status"];
    user_id: string;
    role: EventMemberRow["role"];
    profiles: { avatar: string | null; full_name: string | null } | null;
  }[];
};

export type EventDetail = EventRow & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  event_members: (Pick<EventMemberRow, "id" | "status" | "user_id" | "joined_at" | "role" | "location"> & {
    profiles: { id: string; full_name: string | null; avatar: string | null; city: string | null } | null;
  })[];
};

export type CreateEventParams = {
  ownerId: string;
  name: string;
  eventType: string;
  location: string;
  description: string;
  gender: Database["public"]["Enums"]["game_gender_type"];
  eventDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string;
  dailyHours: number;
};

export type UpdateEventParams = {
  eventId: string;
  // Undefined leaves the icon untouched; null clears it; a string sets it.
  iconUrl?: string | null;
  name: string;
  eventType: string;
  location: string;
  description: string;
  gender: Database["public"]["Enums"]["game_gender_type"];
};

// A multi-day event's real finish line is end_date (its last day), not
// event_date (its first day) — a single-day event leaves end_date null.
// Mirrors hasGameEnded/isGameLive in lib/api/games.ts exactly — events have
// no separate status value for this either, so it's derived purely from
// event_date/start_time/end_date/end_time, same as games/tournaments.
export function hasEventEnded(eventDate: string, endDate: string | null, endTime: string): boolean {
  return new Date(`${endDate ?? eventDate}T${endTime}+05:00`).getTime() < Date.now();
}

export function isEventLive(
  eventDate: string,
  startTime: string,
  endDate: string | null,
  endTime: string
): boolean {
  const started = new Date(`${eventDate}T${startTime}+05:00`).getTime() <= Date.now();
  return started && !hasEventEnded(eventDate, endDate, endTime);
}

const LIST_SELECT =
  "*, profiles!events_event_owner_id_fkey(id, full_name, avatar, latitude, longitude), event_members(id, status, user_id, role, profiles(avatar, full_name))";

const DETAIL_SELECT =
  "*, profiles!events_event_owner_id_fkey(id, full_name, avatar), event_members(id, status, user_id, joined_at, role, location, profiles(id, full_name, avatar, city))";

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export type AllEventsListItem = EventRow & {
  profiles: { id: string; full_name: string | null; email: string | null } | null;
};

const SUPERADMIN_LIST_SELECT = "*, profiles!events_event_owner_id_fkey(id, full_name, email)";

// Superadmin-only: every event regardless of owner — events_select_all
// already lets anyone see non-deleted events, so this only adds search +
// the superadmin-shaped select (owner email, for identifying who made it).
export async function fetchAllEvents(search?: string): Promise<AllEventsListItem[]> {
  let query = supabase
    .from("events")
    .select(SUPERADMIN_LIST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const term = search ? sanitizeSearchTerm(search) : "";
  if (term) {
    query = query.or(`name.ilike.%${term}%,event_code.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AllEventsListItem[];
}

export async function fetchEvents(filters: { search?: string } = {}): Promise<EventListItem[]> {
  let query = supabase
    .from("events")
    .select(LIST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const search = filters.search ? sanitizeSearchTerm(filters.search) : "";
  if (search) {
    query = query.or(`name.ilike.%${search}%,event_type.ilike.%${search}%,event_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as EventListItem[];
}

// Every event the user has a stake in — owned, or an active member of —
// mirrors fetchMySquads. Two queries + a merge-by-id, since PostgREST's
// .or() can't filter the parent row by a joined table's column.
export async function fetchMyEvents(userId: string): Promise<EventListItem[]> {
  const [ownedRes, memberRes] = await Promise.all([
    supabase.from("events").select(LIST_SELECT).eq("event_owner_id", userId).is("deleted_at", null),
    supabase
      .from("event_members")
      .select(`events(${LIST_SELECT})`)
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
  ]);
  if (ownedRes.error) throw new Error(ownedRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);

  const merged = new Map<string, EventListItem>();
  for (const e of (ownedRes.data ?? []) as EventListItem[]) merged.set(e.id, e);
  for (const row of (memberRes.data ?? []) as unknown as { events: EventListItem | null }[]) {
    if (row.events && !row.events.deleted_at) merged.set(row.events.id, row.events);
  }
  return Array.from(merged.values());
}

export async function fetchEventDetail(eventId: string): Promise<EventDetail> {
  const { data, error } = await supabase.from("events").select(DETAIL_SELECT).eq("id", eventId).single();
  if (error) throw new Error(error.message);
  return data as EventDetail;
}

export async function createEvent(params: CreateEventParams): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      event_owner_id: params.ownerId,
      name: params.name,
      event_type: params.eventType,
      location: params.location || null,
      description: params.description || null,
      gender: params.gender,
      event_date: params.eventDate,
      start_time: params.startTime,
      end_date: params.endDate,
      end_time: params.endTime,
      daily_hours: params.dailyHours,
    })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }

  // Owner automatically joins their own event as captain
  const { error: joinError } = await supabase.from("event_members").insert({
    event_id: data.id,
    user_id: params.ownerId,
    role: "captain",
    status: "ACTIVE",
  });
  if (joinError) throw new Error(joinError.message);

  return data;
}

export async function updateEvent(params: UpdateEventParams): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update({
      icon_url: params.iconUrl,
      name: params.name,
      event_type: params.eventType,
      location: params.location || null,
      description: params.description || null,
      gender: params.gender,
    })
    .eq("id", params.eventId)
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

// Owner-only toggle: stops new join requests (and the app's Join/Request to
// Join CTA everywhere) without disbanding the event or touching existing
// members/pending requests.
export async function setEventJoinBlocked(eventId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase.from("events").update({ join_requests_blocked: blocked }).eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function joinEvent(eventId: string, userId: string, location: string): Promise<void> {
  const { error } = await supabase.from("event_members").insert({
    event_id: eventId,
    user_id: userId,
    role: "member",
    status: "PENDING",
    location: location || null,
  });
  if (error) throw new Error(error.message);
}

export async function approveMember(eventMemberId: string): Promise<void> {
  const { error } = await supabase
    .from("event_members")
    .update({ status: "ACTIVE", joined_at: new Date().toISOString() })
    .eq("id", eventMemberId);
  if (error) throw new Error(error.message);
}

export async function rejectMember(eventMemberId: string): Promise<void> {
  const { error } = await supabase.from("event_members").update({ status: "DECLINED" }).eq("id", eventMemberId);
  if (error) throw new Error(error.message);
}

export async function removeMember(eventMemberId: string): Promise<void> {
  const { error } = await supabase.from("event_members").update({ status: "REMOVED" }).eq("id", eventMemberId);
  if (error) throw new Error(error.message);
}

// Promotes/demotes a member to/from "host" — a host has the exact same
// authority as the event owner everywhere in the app (approve/reject/remove
// members, edit event, disband, and promote/demote other hosts), enforced
// server-side by RLS policies that check for an ACTIVE event_members row
// with role='host' alongside the event_owner_id check. The original owner's
// own authority never runs through this role column, so it can't be revoked
// this way.
export async function setMemberHost(eventMemberId: string, isHost: boolean): Promise<void> {
  const { error } = await supabase
    .from("event_members")
    .update({ role: isHost ? "host" : "member" })
    .eq("id", eventMemberId);
  if (error) throw new Error(error.message);
}

export async function leaveEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("event_members")
    .update({ status: "LEFT" })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "PENDING"]);
  if (error) throw new Error(error.message);
}

// Hard delete, not a status transition — mirrors disbandSquad: a soft
// delete (deleted_at) would make the row instantly fail non-owner members'
// SELECT policy, and Realtime only delivers a change event to a subscriber
// if they could still see the row afterward — so disbanding wouldn't
// propagate live to anyone but the owner. event_members and event_messages
// cascade-delete.
export async function disbandEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
}
