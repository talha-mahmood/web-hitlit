import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ProfileState = {
  profile: Profile | null;
  isLoading: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (
    userId: string,
    changes: Partial<Pick<Profile, "full_name" | "avatar" | "skill_level">>
  ) => Promise<void>;
  clear: () => void;
};

// A profile counts as "onboarded" once the user has picked a display name.
export function isProfileComplete(profile: Profile | null): boolean {
  return !!profile?.full_name && profile.full_name.trim().length > 0;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: true,
  fetchProfile: async (userId: string) => {
    set({ isLoading: true });
    // A thrown network error here (not just a normal Postgrest {error}
    // response) must never leave isLoading stuck at true — that's exactly
    // what keeps the whole app parked on the splash screen forever.
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        set({ isLoading: false });
        return;
      }
      set({ profile: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
  updateProfile: async (userId, changes) => {
    const { data, error } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;
    set({ profile: data });
  },
  clear: () => set({ profile: null, isLoading: true }),
}));
