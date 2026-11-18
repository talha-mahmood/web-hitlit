import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCourtBookingsForDate, blockSlot, unblockSlot } from "../lib/api/venuesAdmin";

export function useCourtBookingsForDate(courtId: string, date: string) {
  return useQuery({
    queryKey: ["adminCourtBookings", courtId, date],
    queryFn: () => fetchCourtBookingsForDate(courtId, date),
    enabled: !!courtId && !!date,
  });
}

export function useBlockSlot(courtId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ adminUserId, startTime, endTime }: { adminUserId: string; startTime: string; endTime: string }) =>
      blockSlot(courtId, adminUserId, date, startTime, endTime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminCourtBookings", courtId, date] });
      qc.invalidateQueries({ queryKey: ["bookedSlots", courtId] });
    },
  });
}

export function useUnblockSlot(courtId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => unblockSlot(bookingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminCourtBookings", courtId, date] });
      qc.invalidateQueries({ queryKey: ["bookedSlots", courtId] });
    },
  });
}
