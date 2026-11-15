import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore, isProfileComplete, termsAccepted } from "@app/store/profileStore";
import { initNetworkListener, useNetworkStore } from "@app/store/networkStore";
import { flushTournamentSyncQueue } from "@app/hooks/useTournamentMatches";
import { Alert } from "@/lib/alert";
import SplashPage from "@/pages/SplashPage";
import PrivacyPage from "@/pages/PrivacyPage";
import LoginPage from "@/pages/auth/LoginPage";
import CompleteDetailsPage from "@/pages/onboarding/CompleteDetailsPage";
import AcceptTermsPage from "@/pages/onboarding/AcceptTermsPage";
import AccountSuspendedPage from "@/pages/onboarding/AccountSuspendedPage";
import { rememberReturnTo } from "./returnTo";
import { paths } from "./paths";
import UserRoutes from "./UserRoutes";
import AdminRoutes from "./AdminRoutes";
import InAppNotificationBanner from "@/components/InAppNotificationBanner";

// Web counterpart of the app's RootNavigator: the same session → profile →
// onboarding → role gate, deciding which part of the site renders.
export default function RootGate() {
  const location = useLocation();
  const session = useAuthStore((s) => s.session);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const init = useAuthStore((s) => s.init);

  const profile = useProfileStore((s) => s.profile);
  const isProfileLoading = useProfileStore((s) => s.isLoading);
  const pendingNameCapture = useProfileStore((s) => s.pendingNameCapture);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const subscribeToProfile = useProfileStore((s) => s.subscribeToProfile);
  const clearProfile = useProfileStore((s) => s.clear);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  useEffect(() => {
    initNetworkListener();
  }, []);

  // Tournament-result sync queued while offline flushes app-wide once the
  // connection is back (same as the app's root-level flush).
  const qc = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  useEffect(() => {
    if (!isOnline) return;
    flushTournamentSyncQueue(qc);
  }, [isOnline, qc]);

  useEffect(() => {
    if (!session?.user.id) {
      clearProfile();
      return;
    }
    fetchProfile(session.user.id);
    const unsubscribe = subscribeToProfile(session.user.id);
    return unsubscribe;
  }, [session?.user.id, fetchProfile, subscribeToProfile, clearProfile]);

  // Venue-admin access revoked live by a superadmin → say so plainly.
  const prevTypeRef = useRef<string | null>(null);
  useEffect(() => {
    const prevType = prevTypeRef.current;
    const nextType = profile?.type ?? null;
    if (prevType === "owner" && nextType !== null && nextType !== "owner") {
      Alert.alert(
        "Admin access removed",
        "You're no longer an admin of any venue. You're now using the app as a regular user."
      );
    }
    prevTypeRef.current = nextType;
  }, [profile?.type]);

  // A signed-out visit to a deep link (e.g. a shared comment) is remembered
  // so sign-in lands back on it.
  useEffect(() => {
    if (!isInitializing && !session && location.pathname !== paths.authCallback) {
      rememberReturnTo(location.pathname + location.search);
    }
  }, [isInitializing, session, location.pathname, location.search]);

  // Public pages, reachable signed in or out.
  if (location.pathname === "/privacy") return <PrivacyPage />;

  if (isInitializing) return <SplashPage />;
  // getSession() (inside init) waits for the OAuth code exchange, so by now a
  // failed/cancelled /auth/callback simply has no session — LoginPage shows
  // the provider's error, if any.
  if (!session) return <LoginPage />;
  if (isProfileLoading || pendingNameCapture) return <SplashPage />;
  // An ejected account only ever sees the sign-out screen (checked first);
  // then terms acceptance, then the profile details — same order as the app.
  if (profile && profile.isactive === false) return <AccountSuspendedPage />;
  if (!termsAccepted(profile)) return <AcceptTermsPage />;
  if (!isProfileComplete(profile)) return <CompleteDetailsPage />;
  const routes = profile?.type === "superadmin" ? <AdminRoutes role="superadmin" /> : profile?.type === "owner" ? <AdminRoutes role="owner" /> : <UserRoutes />;
  return (
    <>
      {routes}
      <InAppNotificationBanner />
    </>
  );
}
