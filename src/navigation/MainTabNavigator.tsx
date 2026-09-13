import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import HomeStackNavigator, { type HomeStackParamList } from "./HomeStackNavigator";
import VenuesStackNavigator, { type VenuesStackParamList } from "./VenuesStackNavigator";
import ProfileStackNavigator, { type ProfileStackParamList } from "./ProfileStackNavigator";
import CommunityStackNavigator, { type CommunityStackParamList } from "./CommunityStackNavigator";
import SquadsStackNavigator, { type SquadsStackParamList } from "./SquadsStackNavigator";
import { colors } from "../constants/theme";

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Community: NavigatorScreenParams<CommunityStackParamList> | undefined;
  Squads: NavigatorScreenParams<SquadsStackParamList> | undefined;
  Venues: NavigatorScreenParams<VenuesStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Solid (filled) glyphs, not the "-outline" variants — those have a hollow
// center that reads as an empty icon instead of a solid grey/green shape.
const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Community: "people-circle",
  Squads: "people",
  Venues: "location",
  Profile: "person",
};

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
            <Ionicons
              name={ICONS[route.name as keyof MainTabParamList]}
              color={color}
              size={size}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
      <Tab.Screen name="Squads" component={SquadsStackNavigator} />
      <Tab.Screen name="Venues" component={VenuesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
