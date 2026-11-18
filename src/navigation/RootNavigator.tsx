import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Appearance, Platform, View } from "react-native";
import { vars } from "nativewind";
import * as SystemUI from "expo-system-ui";
import * as NavigationBar from "expo-navigation-bar";
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
import { setActiveThemePalette, themePalettes } from "../constants/theme";
import { getResolvedTheme, hydrateThemePreference, useThemeStore } from "../store/themeStore";
import InAppNotificationBanner from "../components/InAppNotificationBanner";
import { fetchNotificationById } from "../lib/api/notifications";
import { resolveNotificationRecordId, resolveNotificationTarget } from "../lib/notificationTarget";

const navigationRef = createNavigationContainerRef<ParamListBase>();

async function openNotificationDestination(payload: unknown, isAdminSide: boolean): Promise<boolean> {
  let target = resolveNotificationTarget(payload, { isAdmin: isAdminSide });
  if (!target) {
    const notificationId = resolveNotificationRecordId(payload);
    if (notificationId) {
      try {
        const row = await fetchNotificationById(notificationId);
        target = resolveNotificationTarget(row?.data, { isAdmin: isAdminSide });
      } catch {
        // If the record cannot be fetched, the existing inbox fallback below
        // still gives the user access to their notification.
      }
    }
  }
  if (!target || !navigationRef.isReady()) return false;

  switch (target.screen) {
    case "CommentThread":
      navigationRef.navigate("Community", { screen: "CommentThread", params: target.params });
      return true;
    case "GameChat":
      navigationRef.navigate("Home", { screen: "GameChat", params: target.params });
      return true;
    case "TeamChat":
      navigationRef.navigate("Home", { screen: "TeamChat", params: target.params });
      return true;
    case "SquadChat":
      navigationRef.navigate("Home", { screen: "SquadChat", params: target.params });
      return true;
    case "EventChat":
      navigationRef.navigate("Home", { screen: "EventChat", params: target.params });
      return true;
    case "VenueBookings":
      navigationRef.navigate("VenueBookings", target.params);
      return true;
    case "VenueDetail":
      navigationRef.navigate("Home", { screen: "VenueDetail", params: target.params });
      return true;
    case "GameDetail":
      navigationRef.navigate("Home", { screen: "GameDetail", params: target.params });
      return true;
    case "TournamentMatches":
      navigationRef.navigate("Home", { screen: "TournamentMatches", params: target.params });
      return true;
    case "SquadDetail":
      navigationRef.navigate("Home", { screen: "SquadDetail", params: target.params });
      return true;
    case "EventDetail":
      navigationRef.navigate("Home", { screen: "EventDetail", params: target.params });
      return true;
    case "TeamChallengeDetails":
      navigationRef.navigate("Home", { screen: "TeamChallengeDetails", params: target.params });
      return true;
    case "TeamFixtureDetails":
      navigationRef.navigate("Home", { screen: "TeamFixtureDetails", params: target.params });
      return true;
  }
}

const utilityColorPalettes = {
  dark: {
    green: ["#103A2A", "#164A34", "#1C5E3D", "#21834D", "#18C66A", "#18C66A", "#18C66A", "#18C66A", "#0F9F58", "#0B6C3C"],
    red: ["#351419", "#4B1D25", "#7F2531", "#B23B47", "#EF4444", "#EF4444", "#DC2626", "#C81E2B", "#A61B27", "#7F1D1D"],
    blue: ["#102638", "#17384F", "#205472", "#26749A", "#38BDF8", "#0EA5E9", "#0284C7", "#38BDF8", "#0369A1", "#0C4A6E"],
    orange: ["#382516", "#4A301B", "#704522", "#A75F24", "#FB923C", "#F97316", "#FB923C", "#F97316", "#C2410C", "#7C2D12"],
    amber: ["#352A13", "#493715", "#6C5018", "#A87818", "#FBBF24", "#F59E0B", "#FBBF24", "#F59E0B", "#B45309", "#78350F"],
    purple: ["#271C3B", "#35264E", "#4F3675", "#7450A8", "#C084FC", "#A855F7", "#C084FC", "#A855F7", "#7E22CE", "#581C87"],
  },
  light: {
    green: ["#E8F7EE", "#D1F0DD", "#B4E6C7", "#83D5A4", "#35B96E", "#129B53", "#087A3D", "#066333", "#05512B", "#043F22"],
    red: ["#FEF2F2", "#FEE2E2", "#FECACA", "#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#B91C1C", "#991B1B", "#7F1D1D"],
    blue: ["#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A"],
    orange: ["#FFF7ED", "#FFEDD5", "#FED7AA", "#FDBA74", "#FB923C", "#F97316", "#EA580C", "#C2410C", "#9A3412", "#7C2D12"],
    amber: ["#FFFBEB", "#FEF3C7", "#FDE68A", "#FCD34D", "#FBBF24", "#F59E0B", "#D97706", "#B45309", "#92400E", "#78350F"],
    purple: ["#FAF5FF", "#F3E8FF", "#E9D5FF", "#D8B4FE", "#C084FC", "#A855F7", "#9333EA", "#7E22CE", "#6B21A8", "#581C87"],
  },
} as const;

function getUtilityColorVariables(theme: "light" | "dark") {
  return Object.fromEntries(
    (Object.entries(utilityColorPalettes[theme]) as [string, readonly string[]][]).flatMap(([family, shades]) =>
      shades.map((color, index) => [`--jazba-${family}-${index === 0 ? 50 : index * 100}`, color])
    )
  );
}

// Behind every screen (visible during transitions and at the edges): the same
// page colour the Home screen uses.
export default function RootNavigator() {
  const preference = useThemeStore((s) => s.preference);
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme);
  const resolvedTheme = getResolvedTheme({ ...useThemeStore.getState(), preference, systemTheme });
  const palette = themePalettes[resolvedTheme];

  setActiveThemePalette(resolvedTheme);

  useEffect(() => {
    void hydrateThemePreference();
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === "light" ? "light" : "dark");
    });
    return () => subscription.remove();
  }, [setSystemTheme]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.app);
    if (Platform.OS === "android") {
      void NavigationBar.setStyle(resolvedTheme === "light" ? "dark" : "light");
    }
  }, [palette.app, resolvedTheme]);
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
  const [foregroundNotifications, setForegroundNotifications] = useState<Notifications.Notification[]>([]);
  const seenForegroundNotificationIds = useRef(new Set<string>());
  const handleForegroundNotificationDismiss = useCallback((identifier: string) => {
    setForegroundNotifications((current) => current.filter((item) => item.request.identifier !== identifier));
  }, []);
  const handleForegroundNotificationPress = useCallback(async (notification: Notifications.Notification) => {
    if (!navigationRef.isReady()) return;
    const isAdminSide = profile?.type === "owner" || profile?.type === "superadmin";
    const data = notification.request.content.data;
    if (await openNotificationDestination(data, isAdminSide)) return;
    if (isAdminSide) navigationRef.navigate("AdminNotifications");
    else navigationRef.navigate("Home", { screen: "Notifications" });
  }, [profile?.type]);
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

  // This listener only adds an in-app presentation of foreground pushes.
  // The existing setNotificationHandler remains responsible for native OS
  // presentation, and background/tap behavior stays on its existing path.
  useEffect(() => {
    if (!session?.user.id) {
      setForegroundNotifications([]);
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      // Only the active app gets the in-app banner. Read AppState at receipt
      // time so transitions to background cannot reuse a stale React value.
      if (AppState.currentState !== "active") return;
      const id = `${session.user.id}:${notification.request.identifier}`;
      if (seenForegroundNotificationIds.current.has(id)) return;
      seenForegroundNotificationIds.current.add(id);
      if (seenForegroundNotificationIds.current.size > 120) {
        const oldest = seenForegroundNotificationIds.current.values().next().value;
        if (oldest) seenForegroundNotificationIds.current.delete(oldest);
      }
      setForegroundNotifications((current) => [...current, notification]);
    });

    return () => subscription.remove();
  }, [session?.user.id]);

  // Tapping a push notification (including the one that cold-started the
  // app) opens its destination directly when the payload identifies one.
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
      const data = lastResponse.notification.request.content.data;
      void openNotificationDestination(data, isAdminSide).then((opened) => {
        if (opened) return;
        if (isAdminSide) navigationRef.navigate("AdminNotifications");
        else navigationRef.navigate("Home", { screen: "Notifications" });
      });
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

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.primary,
      background: palette.app,
      card: palette.surface,
      text: palette.ink,
      border: palette.border,
    },
  };

  return (
    <View
      style={[
        { flex: 1 },
        vars({
          "--jazba-app": palette.app,
          "--jazba-surface": palette.surface,
          "--jazba-surface-raised": palette.surfaceRaised,
          "--jazba-border": palette.border,
          "--jazba-ink": palette.ink,
          "--jazba-muted": palette.muted,
          "--jazba-primary": palette.primary,
          "--jazba-primary-dark": palette.primaryDark,
          "--jazba-primary-light": palette.primaryLight,
          "--jazba-white": resolvedTheme === "light" ? "#FFFFFF" : "#0A1723",
          "--jazba-gray-50": resolvedTheme === "light" ? "#F8FAFC" : "#0D1C29",
          "--jazba-gray-100": resolvedTheme === "light" ? "#F1F5F9" : "#142533",
          "--jazba-gray-200": resolvedTheme === "light" ? "#E2E8F0" : "#1C2D3A",
          "--jazba-gray-300": resolvedTheme === "light" ? "#CBD5E1" : "#516171",
          "--jazba-gray-400": resolvedTheme === "light" ? "#94A3B8" : "#718092",
          "--jazba-gray-500": resolvedTheme === "light" ? "#64748B" : "#9AA8B7",
          "--jazba-gray-600": resolvedTheme === "light" ? "#475569" : "#AEB9C5",
          "--jazba-gray-700": resolvedTheme === "light" ? "#334155" : "#CBD4DD",
          "--jazba-gray-800": resolvedTheme === "light" ? "#1E293B" : "#E1E7ED",
          "--jazba-gray-900": resolvedTheme === "light" ? "#0F172A" : "#F5F7FA",
          ...getUtilityColorVariables(resolvedTheme),
        }),
      ]}
    >
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>{content}</NavigationContainer>
      <InAppNotificationBanner
        notification={foregroundNotifications[0] ?? null}
        onDismiss={handleForegroundNotificationDismiss}
        onPress={handleForegroundNotificationPress}
      />
    </View>
  );
}
