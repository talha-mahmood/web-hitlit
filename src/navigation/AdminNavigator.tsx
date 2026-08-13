import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminVenueListScreen from "../screens/admin/AdminVenueListScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import EditVenueDetailsScreen from "../screens/admin/EditVenueDetailsScreen";
import ManageVenueImagesScreen from "../screens/admin/ManageVenueImagesScreen";
import ManageCourtsScreen from "../screens/admin/ManageCourtsScreen";
import EditCourtScreen from "../screens/admin/EditCourtScreen";
import ManageFacilitiesScreen from "../screens/admin/ManageFacilitiesScreen";
import AdminSlotsScreen from "../screens/admin/AdminSlotsScreen";
import VenueBookingsScreen from "../screens/admin/VenueBookingsScreen";
import type { VenueEditingParamList } from "./adminTypes";

export type AdminStackParamList = VenueEditingParamList & {
  AdminVenueList: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminVenueList" component={AdminVenueListScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="EditVenueDetails" component={EditVenueDetailsScreen} />
      <Stack.Screen name="ManageVenueImages" component={ManageVenueImagesScreen} />
      <Stack.Screen name="ManageCourts" component={ManageCourtsScreen} />
      <Stack.Screen name="EditCourt" component={EditCourtScreen} />
      <Stack.Screen name="ManageFacilities" component={ManageFacilitiesScreen} />
      <Stack.Screen name="AdminSlots" component={AdminSlotsScreen} />
      <Stack.Screen name="VenueBookings" component={VenueBookingsScreen} />
    </Stack.Navigator>
  );
}
