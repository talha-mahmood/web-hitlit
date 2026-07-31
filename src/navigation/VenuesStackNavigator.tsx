import { createNativeStackNavigator } from "@react-navigation/native-stack";
import VenuesListScreen from "../screens/venues/VenuesListScreen";
import VenueDetailScreen from "../screens/venues/VenueDetailScreen";

export type VenuesStackParamList = {
  VenuesList: { sportId?: string } | undefined;
  VenueDetail: { venueId: string };
};

const Stack = createNativeStackNavigator<VenuesStackParamList>();

export default function VenuesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VenuesList" component={VenuesListScreen} />
      <Stack.Screen name="VenueDetail" component={VenueDetailScreen} />
    </Stack.Navigator>
  );
}
