import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import HomeStackNavigator, { type HomeStackParamList } from "./HomeStackNavigator";
import VenuesStackNavigator, { type VenuesStackParamList } from "./VenuesStackNavigator";
import ProfileStackNavigator, { type ProfileStackParamList } from "./ProfileStackNavigator";
import GamesStackNavigator, { type GamesStackParamList } from "./GamesStackNavigator";
import SquadsStackNavigator, { type SquadsStackParamList } from "./SquadsStackNavigator";
import { colors, fonts } from "../constants/theme";

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Games: NavigatorScreenParams<GamesStackParamList> | undefined;
  Squads: NavigatorScreenParams<SquadsStackParamList> | undefined;
  Venues: NavigatorScreenParams<VenuesStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Games: "tennisball",
  Squads: "people",
  Venues: "location",
  Profile: "person",
};
const ICONS_OUTLINE: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Games: "tennisball-outline",
  Squads: "people-outline",
  Venues: "location-outline",
  Profile: "person-outline",
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: -2 },
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarIcon: ({ focused, color, size }) => (
          <View
            className="items-center justify-center"
            style={{
              width: 40,
              height: 28,
              borderRadius: 14,
              backgroundColor: focused ? colors.lime + "33" : "transparent",
            }}
          >
            <Ionicons
              name={focused ? ICONS[route.name as keyof MainTabParamList] : ICONS_OUTLINE[route.name as keyof MainTabParamList]}
              color={color}
              size={size - 3}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Games" component={GamesStackNavigator} />
      <Tab.Screen name="Squads" component={SquadsStackNavigator} />
      <Tab.Screen name="Venues" component={VenuesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
