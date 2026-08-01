import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBookedSlots,
  createBooking,
  cancelBooking,
  fetchMyBookings,
  type CreateBookingParams,
} from "../lib/api/bookings";
import { useAuthStore } from "../store/authStore";

export function useBookedSlots(courtId: string, date: string) {
  return useQuery({
    queryKey: ["bookedSlots", courtId, date],
    queryFn: () => fetchBookedSlots(courtId, date),
    enabled: !!courtId && !!date,
    staleTime: 30_000,
    refetchInterval: 30_000, // re-check every 30s so concurrent bookings show in real-time
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateBookingParams) => createBooking(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myBookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookedSlots", variables.courtId] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myBookings"] });
    },
  });
}

export function useMyBookings() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["myBookings", userId],
    queryFn: () => fetchMyBookings(userId!),
    enabled: !!userId,
  });
}
