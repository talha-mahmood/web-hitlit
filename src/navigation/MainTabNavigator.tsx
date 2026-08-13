import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
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
// Each section gets its own signature color when active — a small,
// tasteful dose of the "colorful" system rather than one flat brand tint.
const TAB_COLORS: Record<keyof MainTabParamList, string> = {
  Home: colors.primary,
  Games: colors.sky,
  Squads: colors.violet,
  Venues: colors.amber,
  Profile: colors.coral,
};
const TAB_COLORS_LIGHT: Record<keyof MainTabParamList, string> = {
  Home: colors.primaryLight,
  Games: colors.skyLight,
  Squads: colors.violetLight,
  Venues: colors.amberLight,
  Profile: colors.coralLight,
};

function AnimatedTabIcon({ name, focused, color, tint }: { name: keyof MainTabParamList; focused: boolean; color: string; tint: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.12, { damping: 8, stiffness: 260 }, () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 220 });
      });
    }
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        {
          width: 42,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? tint : "transparent",
        },
        animatedStyle,
      ]}
    >
      <Ionicons name={focused ? ICONS[name] : ICONS_OUTLINE[name]} color={color} size={21} />
    </Animated.View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const name = route.name as keyof MainTabParamList;
        return {
          headerShown: false,
          tabBarActiveTintColor: TAB_COLORS[name],
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: -2 },
          tabBarStyle: {
            height: 62,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <View style={{ marginTop: 2 }}>
              <AnimatedTabIcon name={name} focused={focused} color={color} tint={TAB_COLORS_LIGHT[name]} />
            </View>
          ),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Games" component={GamesStackNavigator} />
      <Tab.Screen name="Squads" component={SquadsStackNavigator} />
      <Tab.Screen name="Venues" component={VenuesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
