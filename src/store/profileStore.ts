import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { uniqueChannelName } from "../lib/realtimeChannel";
import type { Database } from "../types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ProfileState = {
  profile: Profile | null;
  isLoading: boolean;
  // True for the brief window right after a fresh Apple sign-in while
  // appleAuth.ts is saving the one-time name Apple just handed over. Lets
  // RootNavigator hold the splash screen until that save has actually
  // landed in the store, so a freshly-loaded profile is never missing a
  // name Apple already gave us. See appleAuth.ts.
  pendingNameCapture: boolean;
  setPendingNameCapture: (value: boolean) => void;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (
    userId: string,
    changes: Partial<Pick<Profile, "full_name" | "avatar" | "skill_level" | "phone" | "gender" | "date_of_birth" | "visibility">>
  ) => Promise<void>;
  // Keeps the store's own profile in sync live — e.g. a superadmin revoking
  // someone's venue-admin access (type 'owner' -> 'user') must be reflected
  // on that person's own device immediately if they're already signed in,
  // not just on their next login.
  subscribeToProfile: (userId: string) => () => void;
  clear: () => void;
};

// A profile counts as fully onboarded once it has the phone number and
// gender we require post-auth — gates CompleteDetailsScreen. Google/Apple
// don't hand us these, so a brand-new sign-in stops here until filled in;
// a returning user who already filled them in skips straight past.
//
// Deliberately does NOT require a display name: there used to be a
// dedicated screen asking for it, but Apple's own App Review guidelines
// (4.x, Sign in with Apple) reject apps that re-ask for a name Apple
// already supplied — and no equivalent screen for other providers either,
// since a missing name is handled gracefully everywhere it's shown (falls
// back to "Profile"/"?") and can always be set later in Account Settings.
export function isProfileComplete(profile: Profile | null): boolean {
  return !!profile?.phone && !!profile?.gender;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  isLoading: true,
  pendingNameCapture: false,
  setPendingNameCapture: (value) => set({ pendingNameCapture: value }),
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
  subscribeToProfile: (userId: string) => {
    const channel = supabase
      .channel(uniqueChannelName(`profile:${userId}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          set({ profile: payload.new as Profile });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  clear: () => set({ profile: null, isLoading: true }),
}));
