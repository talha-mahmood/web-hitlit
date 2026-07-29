import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/main/HomeScreen";
import GamesScreen from "../screens/main/GamesScreen";
import VenuesScreen from "../screens/main/VenuesScreen";
import ProfileScreen from "../screens/main/ProfileScreen";
import { colors } from "../constants/theme";

export type MainTabParamList = {
  Home: undefined;
  Games: undefined;
  Venues: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Games: "tennisball-outline",
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
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={ICONS[route.name as keyof MainTabParamList]}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen name="Venues" component={VenuesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
