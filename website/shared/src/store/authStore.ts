import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  isInitializing: boolean;
  setSession: (session: Session | null) => void;
  init: () => () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isInitializing: true,
  setSession: (session) => set({ session }),
  init: () => {
    // A network hiccup here must never leave the app stuck on the splash
    // screen forever — fall back to "logged out" so AuthNavigator takes over
    // and the user can at least retry, instead of an unrecoverable hang.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        set({ session: data.session, isInitializing: false });
      })
      .catch(() => {
        set({ session: null, isInitializing: false });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ session });
      }
    );

    return () => subscription.subscription.unsubscribe();
  },
}));
