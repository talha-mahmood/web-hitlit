import { supabase } from "../supabase";
import type { Database } from "../../types/database.types";
import type { Venue, Court } from "./venues";

export type MyVenueListItem = Venue & {
  venue_images: { image_url: string }[];
};

export type VenueUpdateInput = Partial<
  Pick<
    Venue,
    | "name"
    | "description"
    | "address"
    | "city"
    | "start_time"
    | "end_time"
    | "isactive"
    | "latitude"
    | "longitude"
    | "phone"
  >
>;

export type CreateVenueInput = {
  name: string;
  description: string;
  address: string;
  city: string;
  startTime: string;
  endTime: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
};

export type CourtInput = {
  name: string;
  sportsId: string;
  pricePerHour: number;
  capacity: number | null;
  surfaceType: string;
  isactive: boolean;
};

export type FacilityInput = { name: string; type: string; description: string };

export type VenueBooking = {
  id: string;
  start_time: string;
  end_time: string;
  status: Database["public"]["Enums"]["booking_status_type"];
  total_amount: number;
  court: { id: string; name: string } | null;
  profiles: { full_name: string | null; avatar: string | null } | null;
};

export async function fetchMyVenues(ownerId: string): Promise<MyVenueListItem[]> {
  const { data, error } = await supabase
    .from("venues")
    .select("*, venue_images(image_url)")
    .eq("venue_owner_id", ownerId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as MyVenueListItem[]) ?? [];
}

export async function updateVenue(venueId: string, changes: VenueUpdateInput): Promise<Venue> {
  const { data, error } = await supabase
    .from("venues")
    .update(changes)
    .eq("id", venueId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Superadmin-only in practice (RLS: venue_owner_id set to null here, so only
// is_superadmin() satisfies venues_insert_owner's WITH CHECK).
export async function createVenue(input: CreateVenueInput): Promise<Venue> {
  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: input.name,
      description: input.description || null,
      address: input.address || null,
      city: input.city || null,
      start_time: input.startTime,
      end_time: input.endTime,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone || null,
      venue_owner_id: null,
      isactive: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addVenueImage(venueId: string, imageUrl: string, displayOrder: number): Promise<void> {
  const { error } = await supabase
    .from("venue_images")
    .insert({ venue_id: venueId, image_url: imageUrl, display_order: displayOrder });
  if (error) throw new Error(error.message);
}

export async function deleteVenueImage(imageId: string): Promise<void> {
  const { error } = await supabase.from("venue_images").delete().eq("id", imageId);
  if (error) throw new Error(error.message);
}

export async function reorderVenueImage(imageId: string, displayOrder: number): Promise<void> {
  const { error } = await supabase.from("venue_images").update({ display_order: displayOrder }).eq("id", imageId);
  if (error) throw new Error(error.message);
}

export async function addCourt(venueId: string, input: CourtInput): Promise<Court> {
  const { data, error } = await supabase
    .from("court")
    .insert({
      venue_id: venueId,
      sports_id: input.sportsId,
      name: input.name,
      price_per_hour: input.pricePerHour,
      capacity: input.capacity,
      surface_type: input.surfaceType || null,
      isactive: input.isactive,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCourt(courtId: string, input: CourtInput): Promise<Court> {
  const { data, error } = await supabase
    .from("court")
    .update({
      sports_id: input.sportsId,
      name: input.name,
      price_per_hour: input.pricePerHour,
      capacity: input.capacity,
      surface_type: input.surfaceType || null,
      isactive: input.isactive,
    })
    .eq("id", courtId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCourt(courtId: string): Promise<void> {
  const { error } = await supabase
    .from("court")
    .update({ isactive: false, deleted_at: new Date().toISOString() })
    .eq("id", courtId);
  if (error) throw new Error(error.message);
}

export async function addFacility(venueId: string, input: FacilityInput): Promise<void> {
  const { error } = await supabase
    .from("venue_facilities")
    .insert({ venue_id: venueId, name: input.name, type: input.type || null, description: input.description || null });
  if (error) throw new Error(error.message);
}

export async function deleteFacility(facilityId: string): Promise<void> {
  const { error } = await supabase.from("venue_facilities").delete().eq("id", facilityId);
  if (error) throw new Error(error.message);
}

export type CourtSlotBooking = {
  id: string;
  start_time: string;
  end_time: string;
  status: Database["public"]["Enums"]["booking_status_type"];
  user_id: string;
  profiles: { full_name: string | null } | null;
};

// Unlike fetchBookedSlots (the anonymized RPC customers use), this reads
// bookings directly so the admin grid can tell BLOCKED (their own synthetic
// row, tappable to unblock) apart from a real CONFIRMED customer booking
// (read-only) — the RPC deliberately can't distinguish these.
export async function fetchCourtBookingsForDate(courtId: string, date: string): Promise<CourtSlotBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, user_id, profiles(full_name)")
    .eq("court_id", courtId)
    .is("deleted_at", null)
    .not("status", "in", "(CANCELLED,EXPIRED)")
    .gte("start_time", `${date}T00:00:00+05:00`)
    .lt("start_time", `${date}T23:59:59+05:00`);
  if (error) throw new Error(error.message);
  return (data as unknown as CourtSlotBooking[]) ?? [];
}

export async function blockSlot(
  courtId: string,
  adminUserId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<void> {
  const { error } = await supabase.from("bookings").insert({
    court_id: courtId,
    user_id: adminUserId,
    start_time: `${date}T${startTime}:00+05:00`,
    end_time: `${date}T${endTime}:00+05:00`,
    status: "BLOCKED",
    total_amount: 0,
    payment_status: "unpaid",
  });
  if (error) throw new Error(error.message);
}

export async function unblockSlot(bookingId: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "BLOCKED");
  if (error) throw new Error(error.message);
}

export async function fetchVenueBookings(venueId: string): Promise<VenueBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, total_amount, court!inner(id, name), profiles(full_name, avatar)")
    .eq("court.venue_id", venueId)
    .is("deleted_at", null)
    .neq("status", "CANCELLED")
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as VenueBooking[]) ?? [];
}
