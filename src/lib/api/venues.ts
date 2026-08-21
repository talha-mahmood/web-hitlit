import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";

export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type VenueImage = Database["public"]["Tables"]["venue_images"]["Row"];
export type VenueFacility = Database["public"]["Tables"]["venue_facilities"]["Row"];
export type Court = Database["public"]["Tables"]["court"]["Row"];

export type VenueListItem = Venue & {
  venue_images: Pick<VenueImage, "image_url" | "display_order">[];
  court: (Pick<Court, "id" | "sports_id" | "price_per_hour"> & {
    sports: { name: string; icon: string | null } | null;
  })[];
};

export type VenueDetail = Venue & {
  venue_images: Pick<VenueImage, "id" | "image_url" | "display_order">[];
  venue_facilities: Pick<VenueFacility, "id" | "name" | "type" | "description">[];
  court: (Court & { sports: { name: string; icon: string | null } | null })[];
};

export type VenueFilters = {
  search?: string;
  // Matches against city or address (e.g. "Lahore", "DHA Phase 6", "Gulberg").
  location?: string;
  sportId?: string;
};

const VENUE_LIST_SELECT = `*, venue_images(image_url, display_order), court(id, sports_id, price_per_hour, sports(name, icon))`;

// PostgREST's .or() filter string treats `,`, `(`, `)` as syntax, so a search
// term containing them would otherwise malform the request — strip them.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export async function fetchVenues(filters: VenueFilters = {}): Promise<VenueListItem[]> {
  const courtRelation = filters.sportId ? "court!inner" : "court";
  let query = supabase
    .from("venues")
    .select(VENUE_LIST_SELECT.replace("court(", `${courtRelation}(`))
    .is("deleted_at", null)
    .eq("isactive", true)
    .order("rating", { ascending: false });

  if (filters.sportId) {
    query = query.eq("court.sports_id", filters.sportId);
  }
  const location = filters.location ? sanitizeSearchTerm(filters.location) : "";
  if (location) {
    query = query.or(`city.ilike.%${location}%,address.ilike.%${location}%`);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as VenueListItem[]) ?? [];
}

export async function fetchVenueDetail(venueId: string): Promise<VenueDetail | null> {
  const { data, error } = await supabase
    .from("venues")
    .select(
      `*, venue_images(id, image_url, display_order), venue_facilities(id, name, type, description), court(*, sports(name, icon))`
    )
    .eq("id", venueId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return data as unknown as VenueDetail;
}

export async function fetchFavoriteVenueIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("favorite_venues")
    .select("venue_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.venue_id));
}

export async function setFavoriteVenue(
  userId: string,
  venueId: string,
  isFavorite: boolean
): Promise<void> {
  if (isFavorite) {
    const { error } = await supabase
      .from("favorite_venues")
      .insert({ user_id: userId, venue_id: venueId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorite_venues")
      .delete()
      .eq("user_id", userId)
      .eq("venue_id", venueId);
    if (error) throw new Error(error.message);
  }
}
