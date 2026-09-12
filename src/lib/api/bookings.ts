import { supabase } from "../supabase";
import { isExclusionViolation } from "../nameValidation";

export type BookingWithCourt = {
  id: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "COMPLETED";
  payment_status: "paid" | "unpaid";
  created_at: string;
  court: {
    id: string;
    name: string;
    venues: {
      id: string;
      name: string;
      city: string | null;
    };
  } | null;
};

export type CreateBookingsParams = {
  courtId: string;
  userId: string;
  date: string;
  // One row is inserted per slot — lets the user book several (contiguous
  // or not) hours in one checkout, each still individually protected by the
  // bookings_no_overlap exclusion constraint.
  slots: { startTime: string; endTime: string; price: number }[];
};

/** Calls SECURITY DEFINER RPC — returns only start+end times, no personal data. */
export async function fetchBookedSlots(courtId: string, date: string) {
  const { data, error } = await supabase.rpc("get_booked_slots", {
    p_court_id: courtId,
    p_date: date,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ start_time: string; end_time: string }>;
}

export async function createBookings(params: CreateBookingsParams) {
  const { courtId, userId, date, slots } = params;

  // A single insert with multiple rows either all succeed or all fail
  // together — if any one slot was just taken by someone else, the whole
  // checkout fails rather than leaving the user with a partial booking.
  const { data, error } = await supabase
    .from("bookings")
    .insert(
      slots.map((slot) => ({
        court_id: courtId,
        user_id: userId,
        // Explicit +05:00 (Pakistan Standard Time) so stored UTC is unambiguous
        start_time: `${date}T${slot.startTime}:00+05:00`,
        end_time: `${date}T${slot.endTime}:00+05:00`,
        total_amount: Math.round(slot.price),
        status: "CONFIRMED" as const,
        payment_status: "unpaid" as const,
      }))
    )
    .select();

  if (error) {
    if (isExclusionViolation(error)) {
      throw new Error("One of these slots was just booked by someone else. Please choose again.");
    }
    throw new Error(error.message);
  }
  return data;
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export async function fetchMyBookings(userId: string): Promise<BookingWithCourt[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      start_time,
      end_time,
      total_amount,
      status,
      payment_status,
      created_at,
      court(
        id,
        name,
        venues(id, name, city)
      )
    `)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("start_time", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BookingWithCourt[];
}
