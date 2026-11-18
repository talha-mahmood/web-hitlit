import { supabase } from "../supabase";

export type VenueReview = {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  owner_response: string | null;
  owner_response_at: string | null;
  profiles: { full_name: string | null; avatar: string | null } | null;
};

export async function fetchVenueReviews(venueId: string): Promise<VenueReview[]> {
  const { data, error } = await supabase
    .from("venue_reviews")
    .select("id, rating, review, created_at, owner_response, owner_response_at, profiles(full_name, avatar)")
    .eq("venue_id", venueId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as VenueReview[]) ?? [];
}

// RPC (not a raw update) so an admin can only ever touch the response
// columns — never the review text or rating itself, which belong to the
// customer who wrote them.
export async function respondToVenueReview(reviewId: string, response: string): Promise<void> {
  const { error } = await supabase.rpc("respond_to_venue_review", {
    target_review_id: reviewId,
    response_text: response,
  });
  if (error) throw new Error(error.message);
}
