import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AllVenuesListScreen from "../screens/superadmin/AllVenuesListScreen";
import CreateVenueScreen from "../screens/superadmin/CreateVenueScreen";
import AssignAdminScreen from "../screens/superadmin/AssignAdminScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import EditVenueDetailsScreen from "../screens/admin/EditVenueDetailsScreen";
import ManageVenueImagesScreen from "../screens/admin/ManageVenueImagesScreen";
import ManageCourtsScreen from "../screens/admin/ManageCourtsScreen";
import EditCourtScreen from "../screens/admin/EditCourtScreen";
import ManageFacilitiesScreen from "../screens/admin/ManageFacilitiesScreen";
import AdminSlotsScreen from "../screens/admin/AdminSlotsScreen";
import VenueBookingsScreen from "../screens/admin/VenueBookingsScreen";
import type { VenueEditingParamList } from "./adminTypes";

export type SuperAdminStackParamList = VenueEditingParamList & {
  AllVenuesList: undefined;
  CreateVenue: undefined;
  AssignAdmin: { venueId: string; venueName: string; currentAdminEmail: string | null };
};

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

// Reuses the exact same venue-editing screen components as AdminNavigator
// (imported from src/screens/admin/) — one implementation, two entry points.
export default function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AllVenuesList" component={AllVenuesListScreen} />
      <Stack.Screen name="CreateVenue" component={CreateVenueScreen} />
      <Stack.Screen name="AssignAdmin" component={AssignAdminScreen} />
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
