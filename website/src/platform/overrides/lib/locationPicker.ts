// Web version of src/lib/locationPicker.ts — browser Geolocation for the
// device's position, Nominatim (OpenStreetMap) for reverse geocoding, since
// there's no OS-native geocoder on the web.
type NominatimAddress = {
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => reject(new Error("Location permission was denied. Enable it in your browser settings to use this.")),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  });
}

async function nominatimReverse(latitude: number, longitude: number, zoom: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=${zoom}&addressdetails=1`,
    { headers: { "Accept-Language": "en" } }
  );
  return (await res.json()) as { display_name?: string; address?: NominatimAddress };
}

function formatAddress(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  const parts = [a.suburb ?? a.neighbourhood ?? a.city_district, a.city ?? a.town ?? a.village, a.state].filter(
    (p): p is string => !!p
  );
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(", ") : null;
}

export async function detectCurrentLocationLabel(): Promise<string> {
  const pos = await getPosition();
  return reverseGeocodeCoordinates(pos.coords.latitude, pos.coords.longitude);
}

export async function detectCurrentCoordinates(): Promise<{ latitude: number; longitude: number; city: string | null }> {
  const pos = await getPosition();
  let city: string | null = null;
  try {
    const data = await nominatimReverse(pos.coords.latitude, pos.coords.longitude, 12);
    city = data.address?.city ?? data.address?.town ?? data.address?.village ?? null;
  } catch {
    // city stays null — same as a failed OS geocode in the app
  }
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city };
}

export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<string> {
  try {
    const data = await nominatimReverse(latitude, longitude, 14);
    const label = formatAddress(data.address);
    if (label) return label;
  } catch {
    // fall through to raw coordinates
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export async function reverseGeocodeViaNominatim(latitude: number, longitude: number): Promise<string> {
  try {
    const data = await nominatimReverse(latitude, longitude, 18);
    if (data.display_name) return data.display_name;
  } catch {
    // fall through
  }
  return reverseGeocodeCoordinates(latitude, longitude);
}

// This app is Pakistan-only — a sensible, central default map center (used
// when location permission is denied/unavailable).
export const PAKISTAN_DEFAULT_CENTER = { latitude: 31.5204, longitude: 74.3587 };

// Short-lived cache for the device's last fix, shared by every map picker.
let cachedDeviceCoords: { latitude: number; longitude: number; timestamp: number } | null = null;
const DEVICE_COORDS_CACHE_TTL_MS = 2 * 60 * 1000;

// Centers a manual map picker on the device's location without blocking on
// it — resolves to null on denial/failure so the caller falls back to
// PAKISTAN_DEFAULT_CENTER.
export async function getDeviceCoordsForMapCenter(): Promise<{ latitude: number; longitude: number } | null> {
  if (cachedDeviceCoords && Date.now() - cachedDeviceCoords.timestamp < DEVICE_COORDS_CACHE_TTL_MS) return cachedDeviceCoords;
  try {
    const pos = await getPosition();
    cachedDeviceCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, timestamp: Date.now() };
    return cachedDeviceCoords;
  } catch {
    return null;
  }
}
