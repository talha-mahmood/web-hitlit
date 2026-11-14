import { useCallback, useEffect, useState } from "react";

export type DeviceLocationStatus = "loading" | "granted" | "denied";

export type DeviceLocationState = {
  coords: { latitude: number; longitude: number } | null;
  status: DeviceLocationStatus;
  requestLocation: () => void;
};

// Web version: browser Geolocation API. Same contract as the app — never
// throws; a denied/unavailable location just means unsorted "near you" lists.
export function useDeviceLocation(): DeviceLocationState {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("loading");

  const requestLocation = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        if (!cancelled) setStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => requestLocation(), [requestLocation]);

  return { coords, status, requestLocation };
}
