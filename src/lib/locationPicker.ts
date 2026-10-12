import * as Location from "expo-location";

function formatAddress(r: Location.LocationGeocodedAddress): string {
  const parts = [r.district, r.city, r.region].filter((p): p is string => !!p);
  const unique = [...new Set(parts)];
  return unique.join(", ") || r.name || "Unknown location";
}

// Detects the device's current location and reverse-geocodes it into a
// human-readable "area, city" string — no separate API key needed, this
// uses the OS's native geocoder (Android Geocoder / iOS CLGeocoder).
export async function detectCurrentLocationLabel(): Promise<string> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission was denied. Enable it in your device settings to use this.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const [address] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  if (!address) {
    throw new Error("Could not determine an address for your current location.");
  }

  return formatAddress(address);
}

// Same GPS capture as detectCurrentLocationLabel, but returns raw
// coordinates (for venues.latitude/longitude — used by "Venues near you"
// distance sorting) plus a reverse-geocoded city, so a venue admin standing
// at their venue can set its map location with one tap instead of typing
// lat/lng manually.
export async function detectCurrentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  city: string | null;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission was denied. Enable it in your device settings to use this.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const [address] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    city: address?.city ?? null,
  };
}

// Reverse-geocodes an arbitrary point (not necessarily the device's own
// location) — used by the OpenStreetMap manual-location picker once the
// host taps/drags a pin, to turn their pick into a readable label without
// typing anything.
export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<string> {
  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (!address) return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return formatAddress(address);
}
