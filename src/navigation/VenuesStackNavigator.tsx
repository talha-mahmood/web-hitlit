import { createNativeStackNavigator } from "@react-navigation/native-stack";
import VenuesListScreen from "../screens/venues/VenuesListScreen";
import VenueDetailScreen from "../screens/venues/VenueDetailScreen";
import SlotPickerScreen from "../screens/venues/SlotPickerScreen";
import BookingCheckoutScreen from "../screens/venues/BookingCheckoutScreen";
import BookingConfirmationScreen from "../screens/venues/BookingConfirmationScreen";
import type { SlotPickerParams, BookingCheckoutParams, BookingConfirmationParams } from "./bookingTypes";

export type VenuesStackParamList = {
  VenuesList: { sportId?: string } | undefined;
  VenueDetail: { venueId: string };
  SlotPicker: SlotPickerParams;
  BookingCheckout: BookingCheckoutParams;
  BookingConfirmation: BookingConfirmationParams;
};

const Stack = createNativeStackNavigator<VenuesStackParamList>();

export default function VenuesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenuesList" component={VenuesListScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <Stack.Screen name="SlotPicker" component={SlotPickerScreen} />
      <Stack.Screen name="BookingCheckout" component={BookingCheckoutScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
    </Stack.Navigator>
  );
}
