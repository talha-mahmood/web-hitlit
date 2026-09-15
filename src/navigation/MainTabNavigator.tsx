import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
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
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
      <Tab.Screen name="Scorecard" component={ScorecardStackNavigator} />
      <Tab.Screen name="Venues" component={VenuesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
