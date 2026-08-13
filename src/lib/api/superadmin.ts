import { supabase } from "../supabase";
import type { Venue } from "./venues";

export type AllVenuesListItem = Venue & {
  profiles: { full_name: string | null; email: string | null } | null;
};

export type AdminLookupResult = { id: string; full_name: string | null; email: string | null; avatar: string | null };

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
