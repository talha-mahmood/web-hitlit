import { useQuery } from "@tanstack/react-query";
import { fetchSports } from "../lib/api/sports";

export function useSports() {
  return useQuery({
    queryKey: ["sports"],
    queryFn: fetchSports,
    staleTime: 60 * 60 * 1000, // sports list rarely changes
  });
}
