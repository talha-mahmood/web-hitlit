import { supabase } from "../supabase";

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

export type CreateBookingParams = {
  courtId: string;
  userId: string;
  date: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  pricePerHour: number;
};

/** Calls SECURITY DEFINER RPC — returns only start+end times, no personal data. */
export async function fetchBookedSlots(courtId: string, date: string) {
  const { data, error } = await supabase.rpc("get_booked_slots", {
    p_court_id: courtId,
    p_date: date,
  });
  if (error) throw error;
  return (data ?? []) as Array<{ start_time: string; end_time: string }>;
}

export async function createBooking(params: CreateBookingParams) {
  const { courtId, userId, date, startTime, endTime, pricePerHour } = params;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const durationHours = (eh + em / 60) - (sh + sm / 60);
  const totalAmount = Math.round(durationHours * pricePerHour);

  // Explicit +05:00 (Pakistan Standard Time) so stored UTC is unambiguous
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      court_id: courtId,
      user_id: userId,
      start_time: `${date}T${startTime}:00+05:00`,
      end_time: `${date}T${endTime}:00+05:00`,
      total_amount: totalAmount,
      status: "CONFIRMED",
      payment_status: "unpaid",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw error;
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

  if (error) throw error;
  return (data ?? []) as BookingWithCourt[];
}
