import { supabase } from "../supabase";
import type { Venue } from "./venues";

export type AllVenuesListItem = Venue & {
  profiles: { full_name: string | null; email: string | null } | null;
};

export type AdminLookupResult = { id: string; full_name: string | null; email: string | null; avatar: string | null };

export type VenueAdmin = {
  id: string;
  user_id: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null; avatar: string | null } | null;
};

export async function fetchAllVenues(search?: string): Promise<AllVenuesListItem[]> {
  let query = supabase
    .from("venues")
    .select("*, profiles!venues_venue_owner_id_fkey(full_name, email)")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as AllVenuesListItem[]) ?? [];
}

export async function lookupProfileByEmail(email: string): Promise<AdminLookupResult | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar")
    .ilike("email", email.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Two sequential writes (small non-atomic window, acceptable for a
// superadmin-only, low-frequency action): assign the venue, then promote
// the profile to 'owner' if it isn't already 'owner'/'superadmin'.
export async function assignVenueAdmin(venueId: string, profileId: string): Promise<void> {
  const { error: venueError } = await supabase
    .from("venues")
    .update({ venue_owner_id: profileId })
    .eq("id", venueId);
  if (venueError) throw new Error(venueError.message);

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", profileId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  if (profile.type === "user") {
    const { error: typeError } = await supabase.from("profiles").update({ type: "owner" }).eq("id", profileId);
    if (typeError) throw new Error(typeError.message);
  }
}

export async function removeVenueAdmin(venueId: string): Promise<void> {
  const { error } = await supabase.from("venues").update({ venue_owner_id: null }).eq("id", venueId);
  if (error) throw new Error(error.message);
}

// Additional (non-primary) admins for a venue — a venue can have exactly one
// owner (venue_owner_id above) plus any number of these secondary admins,
// each with the same read/write access to the venue via is_venue_admin().
export async function fetchVenueAdmins(venueId: string): Promise<VenueAdmin[]> {
  const { data, error } = await supabase
    .from("venue_admins")
    // venue_admins has two FKs into profiles (user_id, added_by) — the FK
    // name must be specified or PostgREST throws an ambiguous-embed error.
    .select("id, user_id, created_at, profiles!venue_admins_user_id_fkey(full_name, email, avatar)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as VenueAdmin[]) ?? [];
}

// RPC (not a raw insert) because granting also needs to flip the target
// profile to 'owner' when it isn't already — a change profiles' own RLS
// blocks for anyone but a superadmin, so the RPC does it under a controlled
// SECURITY DEFINER exemption instead of widening that policy.
export async function grantVenueAdmin(venueId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("grant_venue_admin", {
    target_venue_id: venueId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function revokeVenueAdminAccess(venueId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_venue_admin", {
    target_venue_id: venueId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

// Soft delete, matching the deleted_at convention used everywhere else in
// this app (games, squads, ...) — the venue drops out of every query that
// filters .is("deleted_at", null) (customer browsing, the owner's own
// venue list, this superadmin list) without destroying its history.
export async function deleteVenue(venueId: string): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ deleted_at: new Date().toISOString(), isactive: false })
    .eq("id", venueId);
  if (error) throw new Error(error.message);
}
