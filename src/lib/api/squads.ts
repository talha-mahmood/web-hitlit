import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

type SquadRow = Database["public"]["Tables"]["squads"]["Row"];
type SquadMemberRow = Database["public"]["Tables"]["squad_members"]["Row"];

export type SquadListItem = SquadRow & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  squad_members: { id: string; status: SquadMemberRow["status"]; user_id: string }[];
};

export type SquadDetail = SquadRow & {
  profiles: { id: string; full_name: string | null; avatar: string | null } | null;
  squad_members: (Pick<
    SquadMemberRow,
    "id" | "status" | "user_id" | "joined_at" | "role"
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

export type CreateSquadParams = {
  ownerId: string;
  name: string;
  skillLevel: Database["public"]["Enums"]["skill_level_type"] | null;
  location: string;
  description: string;
};

export type UpdateSquadParams = {
  squadId: string;
  name: string;
  skillLevel: Database["public"]["Enums"]["skill_level_type"] | null;
  location: string;
  description: string;
};

const LIST_SELECT =
  "*, profiles!squads_squad_owner_id_fkey(id, full_name, avatar), squad_members(id, status, user_id)";

const DETAIL_SELECT =
  "*, profiles!squads_squad_owner_id_fkey(id, full_name, avatar), squad_members(id, status, user_id, joined_at, role, profiles(id, full_name, avatar, skill_level, city))";

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export async function fetchSquads(
  filters: { search?: string } = {}
): Promise<SquadListItem[]> {
  let query = supabase
    .from("squads")
    .select(LIST_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const search = filters.search ? sanitizeSearchTerm(filters.search) : "";
  if (search) {
    query = query.or(`name.ilike.%${search}%,squad_code.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SquadListItem[];
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
      skill_level: params.skillLevel,
      location: params.location || null,
      description: params.description || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

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
      name: params.name,
      skill_level: params.skillLevel,
      location: params.location || null,
      description: params.description || null,
    })
    .eq("id", params.squadId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function joinSquad(squadId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("squad_members").insert({
    squad_id: squadId,
    user_id: userId,
    role: "member",
    status: "PENDING",
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

export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("squad_members")
    .update({ status: "LEFT" })
    .eq("squad_id", squadId)
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "PENDING"]);
  if (error) throw new Error(error.message);
}

// Squads aren't time-bound like games (no date/status lifecycle), so
// "disbanding" is a soft delete rather than a status transition.
export async function disbandSquad(squadId: string): Promise<void> {
  const { error } = await supabase
    .from("squads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", squadId);
  if (error) throw new Error(error.message);
}
