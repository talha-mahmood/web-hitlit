import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

export type DeviceLocationStatus = "loading" | "granted" | "denied";

export type DeviceLocationState = {
  coords: { latitude: number; longitude: number } | null;
  status: DeviceLocationStatus;
  requestLocation: () => void;
};

// Used to sort "near you" lists (games/squads/venues) by real distance on
// the new home page — falls back to `status: "denied"` (callers show
// unsorted lists + a banner) rather than throwing, since browsing without
// location is still a valid, common flow.
export function useDeviceLocation(): DeviceLocationState {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("loading");

  const requestLocation = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus !== "granted") {
          if (!cancelled) setStatus("denied");
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStatus("granted");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => requestLocation(), [requestLocation]);

  return { coords, status, requestLocation };
}
