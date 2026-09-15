import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StackActions, type NavigatorScreenParams } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import HomeStackNavigator, { type HomeStackParamList } from "./HomeStackNavigator";
import VenuesStackNavigator, { type VenuesStackParamList } from "./VenuesStackNavigator";
import ProfileStackNavigator, { type ProfileStackParamList } from "./ProfileStackNavigator";
import CommunityStackNavigator, { type CommunityStackParamList } from "./CommunityStackNavigator";
import ScorecardStackNavigator, { type ScorecardStackParamList } from "./ScorecardStackNavigator";
import { colors } from "../constants/theme";

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
  Profile: "person",
};
// Ionicons only has a two-person "people" glyph — MaterialCommunityIcons'
// "account-group" is the same idea with a third figure, which is what
// Community's icon should look like. "cricket" for Scorecard is also
// MaterialCommunityIcons-only (Ionicons has no cricket glyph at all).
const COMMUNITY_ICON = "account-group" as const;
const SCORECARD_ICON = "cricket" as const;

export default function MainTabNavigator() {
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
        tabBarIcon: ({ focused, color, size }) => (
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 20,
                height: 3,
                borderRadius: 2,
                marginBottom: 5,
                backgroundColor: focused ? colors.primary : "transparent",
              }}
            />
            {route.name === "Community" ? (
              <MaterialCommunityIcons name={COMMUNITY_ICON} color={color} size={size} />
            ) : route.name === "Scorecard" ? (
              <MaterialCommunityIcons name={SCORECARD_ICON} color={color} size={size} />
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
