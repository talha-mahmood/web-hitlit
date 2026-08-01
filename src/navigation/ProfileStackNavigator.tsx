import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/main/ProfileScreen";
import MyBookingsScreen from "../screens/main/MyBookingsScreen";

export type ProfileStackParamList = {
  ProfileHome: undefined;
  MyBookings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
    </Stack.Navigator>
  );
}
