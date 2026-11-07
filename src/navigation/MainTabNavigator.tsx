import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StackActions, type NavigatorScreenParams } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import HomeStackNavigator, { type HomeStackParamList } from "./HomeStackNavigator";
import VenuesStackNavigator, { type VenuesStackParamList } from "./VenuesStackNavigator";
import ProfileStackNavigator, { type ProfileStackParamList } from "./ProfileStackNavigator";
import CommunityStackNavigator, { type CommunityStackParamList } from "./CommunityStackNavigator";
import ScorecardStackNavigator, { type ScorecardStackParamList } from "./ScorecardStackNavigator";
import { colors } from "../constants/theme";
import ScorecardTabIcon from "../components/ScorecardTabIcon";
import ProfileTabIcon from "../components/ProfileTabIcon";

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Community: NavigatorScreenParams<CommunityStackParamList> | undefined;
  Scorecard: NavigatorScreenParams<ScorecardStackParamList> | undefined;
  Venues: NavigatorScreenParams<VenuesStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Each tab is its own stack navigator that, by default, keeps whatever
// screen you drilled into even after you switch away and back — the user
// wants every tab to instead reset to its own root screen once you've left
// it, no matter how deep you'd navigated. `blur` fires when a tab loses
// focus (i.e. the moment you switch to a different tab); popping that
// tab's own nested stack back to its top there means it's already reset by
// the time you return to it. The action carries an explicit `target` (the
// nested stack's own state key) so it's routed straight to that stack
// instead of bubbling to a navigator that doesn't understand it.
function resetTabOnBlur({ navigation, route }: { navigation: any; route: { key: string } }) {
  return {
    blur: () => {
      const tabRoute = navigation.getState().routes.find((r: { key: string }) => r.key === route.key);
      if (tabRoute?.state && tabRoute.state.index > 0) {
        navigation.dispatch({ ...StackActions.popToTop(), target: tabRoute.state.key });
      }
    },
  };
}

// Solid (filled) glyphs, not the "-outline" variants — those have a hollow
// center that reads as an empty icon instead of a solid grey/green shape.
const ICONS: Partial<Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap>> = {
  Home: "home",
  Venues: "location",
};
// Ionicons only has a two-person "people" glyph — MaterialCommunityIcons'
// "account-group" is the same idea with a third figure, which is what
// Community's icon should look like. (Scorecard uses its own SVG icon —
// see ScorecardTabIcon.)
const COMMUNITY_ICON = "account-group" as const;

export default function MainTabNavigator() {
  // Setting an explicit tabBarStyle.height opts out of React Navigation's
  // own safe-area-aware default height, so without adding the bottom inset
  // back in here, the icon row sits too low and gets covered by the
  // device's own gesture bar / 3-button nav bar.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      // Default is "history": once you've switched tabs at least once,
      // canGoBack() starts returning true even on a tab's own root screen
      // (nothing left to pop in *that* tab's stack, but there's tab-switch
      // history to unwind) — that's what was making the back arrow appear
      // on screens like the Squads list and, when pressed, jump to whatever
      // tab was open before instead of doing nothing. "none" makes
      // canGoBack() only reflect the current tab's own stack, so a tab's
      // root screen never shows a back arrow that jumps to a different tab.
      backBehavior="none"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 1, marginBottom: 2, letterSpacing: -0.25 },
        // Keep the bar flush with the screen edges so the underlying screen
        // cannot show through as white wedges at its top corners.
        tabBarStyle: {
          backgroundColor: colors.surface,
          height: 76 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarIcon: ({ focused, color, size }) => (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 46,
              height: 44,
              borderRadius: 15,
              marginBottom: 2,
              backgroundColor: focused ? "rgba(24,198,106,0.16)" : "transparent",
            }}
          >
            {route.name === "Community" ? (
              <MaterialCommunityIcons name={COMMUNITY_ICON} color={color} size={size} />
            ) : route.name === "Scorecard" ? (
              <ScorecardTabIcon color={color} size={size} />
            ) : route.name === "Profile" ? (
              <ProfileTabIcon focused={focused} size={size} />
            ) : (
              <Ionicons
                name={ICONS[route.name as keyof MainTabParamList]!}
                color={color}
                size={size}
              />
            )}
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} listeners={resetTabOnBlur} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} listeners={resetTabOnBlur} />
      <Tab.Screen name="Scorecard" component={ScorecardStackNavigator} listeners={resetTabOnBlur} />
      <Tab.Screen name="Venues" component={VenuesStackNavigator} listeners={resetTabOnBlur} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} listeners={resetTabOnBlur} />
    </Tab.Navigator>
  );
}
