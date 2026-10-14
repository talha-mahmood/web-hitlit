import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type SquadRow = Database["public"]["Tables"]["squads"]["Row"];
type SquadMemberRow = Database["public"]["Tables"]["squad_members"]["Row"];

export type SquadListItem = SquadRow & {
  profiles: {
    id: string;
    full_name: string | null;
    avatar: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  sports: { id: string; name: string } | null;
  squad_members: {
    id: string;
    status: SquadMemberRow["status"];
    user_id: string;
    role: SquadMemberRow["role"];
    profiles: { avatar: string | null; full_name: string | null } | null;
  }[];
};

export type SquadDetail = SquadRow & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  sports: { id: string; name: string } | null;
  squad_members: (Pick<
    SquadMemberRow,
    "id" | "status" | "user_id" | "joined_at" | "role" | "skill_level" | "location"
  > & {
    profiles: {
      id: string;
      full_name: string | null;
      avatar: string | null;
      skill_level: Database["public"]["Enums"]["skill_level_type"] | null;
      city: string | null;
    } | null;
  })[];
};

export type SquadGroupType = "group" | "club" | "training_camp" | "team";

export type CreateSquadParams = {
  ownerId: string;
  name: string;
  sportId: string;
  skillLevel: Database["public"]["Enums"]["skill_level_type"] | null;
  location: string;
  description: string;
  gender: Database["public"]["Enums"]["game_gender_type"];
  groupType: SquadGroupType;
};

// Sport is intentionally excluded — same reasoning as games' UpdateGameParams:
// changing it post-creation would strand members who joined for a specific sport.
export type UpdateSquadParams = {
  squadId: string;
  // Undefined leaves the icon untouched; null clears it; a string sets it.
  iconUrl?: string | null;
  name: string;
  skillLevel: Database["public"]["Enums"]["skill_level_type"] | null;
  location: string;
  description: string;
  gender: Database["public"]["Enums"]["game_gender_type"];
};

const LIST_SELECT =
  "*, sports(id, name), profiles!squads_squad_owner_id_fkey(id, full_name, avatar, latitude, longitude), squad_members(id, status, user_id, role, profiles(avatar, full_name))";

const DETAIL_SELECT =
  "*, sports(id, name), profiles!squads_squad_owner_id_fkey(id, full_name, avatar), squad_members(id, status, user_id, joined_at, role, skill_level, location, profiles(id, full_name, avatar, skill_level, city))";

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export async function fetchSquads(
  filters: { search?: string; sportId?: string } = {}
): Promise<SquadListItem[]> {
  let query = supabase
    .from("squads")
    .select(LIST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.sportId) {
    query = query.eq("sport_id", filters.sportId);
  }
  const search = filters.search ? sanitizeSearchTerm(filters.search) : "";
  if (search) {
    query = query.or(`name.ilike.%${search}%,squad_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SquadListItem[];
}

// Squads the user owns OR hosts, for pickers like "fill this empty team
// with my squad" — needs squad_members embedded (already in LIST_SELECT) so
// the caller can filter to ACTIVE members and check the squad is big
// enough. A host has the same authority as the owner here too (the
// squad_fill_* RPCs this feeds into accept either), so it has to look
// beyond just squad_owner_id — same two-query-then-merge shape as
// fetchMySquads below, since PostgREST can't filter squads by a joined
// table's column in one request.
export async function fetchMyOwnedSquads(userId: string): Promise<SquadListItem[]> {
  const [ownedRes, hostedRes] = await Promise.all([
    supabase.from("squads").select(LIST_SELECT).eq("squad_owner_id", userId).is("deleted_at", null),
    supabase
      .from("squad_members")
      .select(`squads(${LIST_SELECT})`)
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .eq("role", "host"),
  ]);
  if (ownedRes.error) throw new Error(ownedRes.error.message);
  if (hostedRes.error) throw new Error(hostedRes.error.message);

  const merged = new Map<string, SquadListItem>();
  for (const s of (ownedRes.data ?? []) as SquadListItem[]) merged.set(s.id, s);
  for (const row of (hostedRes.data ?? []) as unknown as { squads: SquadListItem | null }[]) {
    if (row.squads && !row.squads.deleted_at) merged.set(row.squads.id, row.squads);
  }
  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Every squad the user has a stake in — owned, or an active member of —
// for pickers like "Fill with my Squad" (unlike fetchMyOwnedSquads, which
// only covers squads they created). Two queries + a merge-by-id, since
// PostgREST's .or() can't filter the parent row by a joined table's column.
export async function fetchMySquads(userId: string): Promise<SquadListItem[]> {
  const [ownedRes, memberRes] = await Promise.all([
    supabase.from("squads").select(LIST_SELECT).eq("squad_owner_id", userId).is("deleted_at", null),
    supabase
      .from("squad_members")
      .select(`squads(${LIST_SELECT})`)
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
  ]);
  if (ownedRes.error) throw new Error(ownedRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);

  const merged = new Map<string, SquadListItem>();
  for (const s of (ownedRes.data ?? []) as SquadListItem[]) merged.set(s.id, s);
  for (const row of (memberRes.data ?? []) as unknown as { squads: SquadListItem | null }[]) {
    if (row.squads && !row.squads.deleted_at) merged.set(row.squads.id, row.squads);
  }
  return Array.from(merged.values());
}

export async function fetchSquadDetail(squadId: string): Promise<SquadDetail> {
  const { data, error } = await supabase
    .from("squads")
    .select(DETAIL_SELECT)
    .eq("id", squadId)
    .single();
  if (error) throw new Error(error.message);
  return data as SquadDetail;
}

export async function createSquad(params: CreateSquadParams): Promise<SquadRow> {
  const { data, error } = await supabase
    .from("squads")
    .insert({
      squad_owner_id: params.ownerId,
      name: params.name,
      sport_id: params.sportId,
      skill_level: params.skillLevel,
      location: params.location || null,
      description: params.description || null,
      gender: params.gender,
      group_type: params.groupType,
    })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }

  // Owner automatically joins their own squad as captain
  const { error: joinError } = await supabase.from("squad_members").insert({
    squad_id: data.id,
    user_id: params.ownerId,
    role: "captain",
    status: "ACTIVE",
  });
  if (joinError) throw new Error(joinError.message);

  return data;
}

export async function updateSquad(params: UpdateSquadParams): Promise<SquadRow> {
  const { data, error } = await supabase
    .from("squads")
    .update({
      icon_url: params.iconUrl,
      name: params.name,
      skill_level: params.skillLevel,
      location: params.location || null,
      description: params.description || null,
      gender: params.gender,
    })
    .eq("id", params.squadId)
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

// Owner-only toggle: stops new join requests (and the app's Join/Request to
// Join CTA everywhere) without disbanding the squad or touching existing
// members/pending requests.
export async function setSquadJoinBlocked(squadId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase
    .from("squads")
    .update({ join_requests_blocked: blocked })
    .eq("id", squadId);
  if (error) throw new Error(error.message);
}

export async function joinSquad(
  squadId: string,
  userId: string,
  skillLevel: Database["public"]["Enums"]["skill_level_type"],
  location: string
): Promise<void> {
  const { error } = await supabase.from("squad_members").insert({
    squad_id: squadId,
    user_id: userId,
    role: "member",
    status: "PENDING",
    skill_level: skillLevel,
    location: location || null,
  });
  if (error) throw new Error(error.message);
}

export async function approveMember(squadMemberId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ status: "ACTIVE", joined_at: new Date().toISOString() })
    .eq("id", squadMemberId);
  if (error) throw new Error(error.message);
}

export async function rejectMember(squadMemberId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ status: "DECLINED" })
    .eq("id", squadMemberId);
  if (error) throw new Error(error.message);
}

export async function removeMember(squadMemberId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ status: "REMOVED" })
    .eq("id", squadMemberId);
  if (error) throw new Error(error.message);
}

// Promotes/demotes a member to/from "host" — a host has the exact same
// authority as the squad owner everywhere in the app (approve/reject/remove
// members, edit squad, invite, disband, and promote/demote other hosts),
// enforced server-side by RLS policies that check for an ACTIVE
// squad_members row with role='host' alongside the squad_owner_id check.
// The original owner's own authority never runs through this role column,
// so it can't be revoked this way.
export async function setMemberHost(squadMemberId: string, isHost: boolean): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ role: isHost ? "host" : "member" })
    .eq("id", squadMemberId);
  if (error) throw new Error(error.message);
}

export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ status: "LEFT" })
    .eq("squad_id", squadId)
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "PENDING"]);
  if (error) throw new Error(error.message);
}

// Hard delete, not a status transition — mirrors how games are hard-deleted
// on expiry. A soft delete (deleted_at) would make the row instantly fail
// non-owner members' SELECT policy, and Realtime only delivers a change
// event to a subscriber if they could still see the row afterward — so
// disbanding wouldn't propagate live to anyone but the owner. squad_members
// and squad_messages cascade-delete; games.squad_id is SET NULL.
export async function disbandSquad(squadId: string): Promise<void> {
  const { error } = await supabase.from("squads").delete().eq("id", squadId);
  if (error) throw new Error(error.message);
}
