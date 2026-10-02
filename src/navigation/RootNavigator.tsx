import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef, type ParamListBase } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { registerForPushNotifications } from "../lib/pushNotifications";
import { useAuthStore } from "../store/authStore";
import { useProfileStore, isProfileComplete } from "../store/profileStore";
import SplashScreen from "../screens/SplashScreen";
import AuthNavigator from "./AuthNavigator";
import MainTabNavigator from "./MainTabNavigator";
import AdminNavigator from "./AdminNavigator";
import SuperAdminNavigator from "./SuperAdminNavigator";
import CompleteDetailsScreen from "../screens/onboarding/CompleteDetailsScreen";

const navigationRef = createNavigationContainerRef<ParamListBase>();

// Behind every screen (visible during transitions and at the edges): the same
// page colour the Home screen uses.
const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#FFFFFF" },
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
  // profile setup.
  const pushReady = !!session && !isProfileLoading && isProfileComplete(profile);

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

  if (isInitializing) {
    return <SplashScreen />;
  }

  let content;
  if (!session) {
    content = <AuthNavigator />;
  } else if (isProfileLoading || pendingNameCapture) {
    content = <SplashScreen />;
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
