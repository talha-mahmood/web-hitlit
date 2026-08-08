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
