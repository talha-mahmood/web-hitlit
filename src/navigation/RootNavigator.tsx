import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef, type ParamListBase } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { registerForPushNotifications } from "../lib/pushNotifications";
import { useAuthStore } from "../store/authStore";
import { useProfileStore, isProfileComplete, termsAccepted } from "../store/profileStore";
import { initNetworkListener, useNetworkStore } from "../store/networkStore";
import { flushTournamentSyncQueue } from "../hooks/useTournamentMatches";
import SplashScreen from "../screens/SplashScreen";
import AuthNavigator from "./AuthNavigator";
import MainTabNavigator from "./MainTabNavigator";
import AdminNavigator from "./AdminNavigator";
import SuperAdminNavigator from "./SuperAdminNavigator";
import CompleteDetailsScreen from "../screens/onboarding/CompleteDetailsScreen";
import AcceptTermsScreen from "../screens/onboarding/AcceptTermsScreen";
import AccountSuspendedScreen from "../screens/onboarding/AccountSuspendedScreen";

const navigationRef = createNavigationContainerRef<ParamListBase>();

// Behind every screen (visible during transitions and at the edges): the same
// page colour the Home screen uses.
const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#050B12" },
};

export default function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const init = useAuthStore((s) => s.init);

  const profile = useProfileStore((s) => s.profile);
  const isProfileLoading = useProfileStore((s) => s.isLoading);
  // Set while appleAuth.ts is saving the one-time name Apple just handed
  // over on a fresh sign-in — see profileStore.ts for why this exists.
  const pendingNameCapture = useProfileStore((s) => s.pendingNameCapture);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const subscribeToProfile = useProfileStore((s) => s.subscribeToProfile);
  const clearProfile = useProfileStore((s) => s.clear);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  // Starts listening for connectivity changes app-wide, regardless of
  // which screen is open — live scoring's offline queues (useCricket.ts
  // and friends) flush as soon as this flips back to online.
  useEffect(() => {
    initNetworkListener();
  }, []);

  // Tournament-result sync (did Team A or Team B win) is the one offline
  // queue that can't rely on its own match's screen still being open to
  // flush it — a user who scores offline then backs out to the match list
  // before reconnecting leaves nothing with that matchId mounted. This
  // mirrors every other sport's own "flush whenever isOnline is true" effect
  // (see useCricketMatch in useCricket.ts) but at the app root, so it covers
  // both reconnecting from any screen and relaunching the app already online
  // with leftovers queued from a previous offline session.
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

  // A superadmin revoking venue-admin access while that person is already
  // signed in flips their profile.type live via the subscription above —
  // catch that specific transition to tell them plainly what happened,
  // instead of the admin dashboard just silently disappearing underneath
  // them mid-tap.
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

  // Push notifications only start once the person is fully signed in and
  // past onboarding, so the system permission prompt never interrupts
  // profile setup. Also waits on terms acceptance and gates out a
  // suspended account entirely.
  const pushReady =
    !!session &&
    !isProfileLoading &&
    isProfileComplete(profile) &&
    termsAccepted(profile) &&
    profile?.isactive !== false;

  useEffect(() => {
    if (pushReady) registerForPushNotifications();
  }, [pushReady, session?.user.id]);

  // Tapping a push notification (including the one that cold-started the
  // app) opens that account's notifications screen.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse || !pushReady) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const responseKey = lastResponse.notification.request.identifier;
    if (handledResponseRef.current === responseKey) return;

    const isAdminSide = profile?.type === "owner" || profile?.type === "superadmin";
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      if (!navigationRef.isReady()) {
        retry = setTimeout(open, 300);
        return;
      }
      handledResponseRef.current = responseKey;
      if (isAdminSide) navigationRef.navigate("AdminNotifications");
      else navigationRef.navigate("Home", { screen: "Notifications" });
    };
    open();
    return () => {
      if (retry) clearTimeout(retry);
    };
  }, [lastResponse, pushReady, profile?.type]);

  // A shared "comment/<rootId>" link (see CommentThreadScreen's Share
  // button) opens that comment thread directly, scrolled to and flashing
  // the specific reply if one was shared — same retry-until-ready pattern
  // as the push-notification handler above, since the nav tree may not be
  // mounted yet (cold start) when the link arrives.
  useEffect(() => {
    const openCommentLink = (url: string) => {
      const { path, queryParams } = Linking.parse(url);
      const match = path?.match(/^comment\/([^/?]+)/);
      if (!match) return;
      const rootId = match[1];
      const highlightId = typeof queryParams?.highlight === "string" ? queryParams.highlight : undefined;

      let retry: ReturnType<typeof setTimeout> | undefined;
      const open = () => {
        if (!navigationRef.isReady()) {
          retry = setTimeout(open, 300);
          return;
        }
        navigationRef.navigate("Community", { screen: "CommentThread", params: { rootId, highlightId } });
      };
      open();
      return () => {
        if (retry) clearTimeout(retry);
      };
    };

    Linking.getInitialURL().then((url) => {
      if (url) openCommentLink(url);
    });
    const subscription = Linking.addEventListener("url", (event) => openCommentLink(event.url));
    return () => subscription.remove();
  }, []);

  if (isInitializing) {
    return <SplashScreen />;
  }

  let content;
  if (!session) {
    content = <AuthNavigator />;
  } else if (isProfileLoading || pendingNameCapture) {
    content = <SplashScreen />;
  } else if (profile && profile.isactive === false) {
    // A superadmin ejected this account via the Moderation screen — checked
    // before anything else so a suspended user never sees onboarding or the
    // rest of the app, only the sign-out screen. subscribeToProfile's
    // realtime subscription means an already-open session is suspended live
    // the moment the flag flips, not just on next login.
    content = <AccountSuspendedScreen />;
  } else if (!termsAccepted(profile)) {
    // Required under App Store guideline 1.2 — covers both a brand-new
    // sign-up and any pre-existing account/session that predates this
    // requirement.
    content = <AcceptTermsScreen />;
  } else if (!isProfileComplete(profile)) {
    // Google/Apple sign-in doesn't give us a phone number or gender — a
    // brand-new account stops here to fill those in; a returning account
    // that already has them skips straight past to its dashboard below.
    content = <CompleteDetailsScreen />;
  } else if (profile?.type === "superadmin") {
    content = <SuperAdminNavigator />;
  } else if (profile?.type === "owner") {
    content = <AdminNavigator />;
  } else {
    content = <MainTabNavigator />;
  }

  return <NavigationContainer ref={navigationRef} theme={AppTheme}>{content}</NavigationContainer>;
}
