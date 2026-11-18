import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { colors } from "@app/constants/theme";
import { getDeviceCoordsForMapCenter, reverseGeocodeViaNominatim, PAKISTAN_DEFAULT_CENTER } from "@app/lib/locationPicker";
import { Ionicon } from "../icons/Icon";
import Spinner from "../ui/Spinner";

const pinIcon = L.icon({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

type SearchResult = { label: string; lat: number; lng: number };
type LatLng = { lat: number; lng: number };

// Port of LocationMapPicker: the same Leaflet + OpenStreetMap map the app
// loads inside a WebView, used directly. With no initial coordinates it
// centers itself on the device's location (Pakistan default if denied);
// the map only appears once a center is known. Drag the pin or click the
// map; live Nominatim search (Pakistan only) moves it; the search box
// echoes the pin's address; full-screen toggle; "Use This Location"
// confirms and collapses the picker to a summary row (tap it to change).
export default function LocationMapPicker({
  initialLat,
  initialLng,
  onConfirm,
  confirming,
  selectedLabel,
}: {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  confirming: boolean;
  selectedLabel?: string | null;
}) {
  const hasInitial = initialLat != null && initialLng != null;
  const [picked, setPicked] = useState<LatLng | null>(hasInitial ? { lat: initialLat!, lng: initialLng! } : null);
  const autoDetectStarted = useRef(hasInitial);
  useEffect(() => {
    if (autoDetectStarted.current) return;
    autoDetectStarted.current = true;
    void getDeviceCoordsForMapCenter().then((c) =>
      setPicked(c ? { lat: c.latitude, lng: c.longitude } : { lat: PAKISTAN_DEFAULT_CENTER.latitude, lng: PAKISTAN_DEFAULT_CENTER.longitude })
    );
  }, []);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchId = useRef(0);
  const geocodeId = useRef(0);
  const skipGeocode = useRef(false);
  const lastGeocodedKey = useRef<string | null>(null);
  const hasCenter = picked !== null;

  // The map mounts once a center is known (and again when the picker is
  // reopened from its summary row).
  useEffect(() => {
    if (!hasCenter || !pickerOpen || !mapEl.current) return;
    const start = picked!;
    const map = L.map(mapEl.current).setView([start.lat, start.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on("dragend", () => setPicked(marker.getLatLng()));
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setPicked(e.latlng);
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCenter, pickerOpen]);

  // Full-screen changes the container size — let Leaflet re-measure.
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    if (fullscreen) window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // The search box echoes wherever the pin is (auto-detected center, drag,
  // tap) — except right after a search pick, which set its own label.
  useEffect(() => {
    if (!picked) return;
    const key = `${picked.lat},${picked.lng}`;
    if (skipGeocode.current) {
      skipGeocode.current = false;
      lastGeocodedKey.current = key;
      return;
    }
    if (key === lastGeocodedKey.current) return;
    lastGeocodedKey.current = key;
    const id = ++geocodeId.current;
    reverseGeocodeViaNominatim(picked.lat, picked.lng)
      .then((label) => id === geocodeId.current && setQuery(label))
      .catch(() => {});
  }, [picked]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const id = ++searchId.current;
      setSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=pk`, { headers: { "Accept-Language": "en" } });
        const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
        if (id === searchId.current) setResults(data.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
      } catch {
        if (id === searchId.current) setResults([]);
      } finally {
        if (id === searchId.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // A search typed after the pin moved shouldn't re-list results for the
  // echoed address itself.
  const pickResult = (r: SearchResult) => {
    setResults([]);
    setQuery(r.label);
    skipGeocode.current = true;
    setPicked({ lat: r.lat, lng: r.lng });
    mapRef.current?.setView([r.lat, r.lng], 15);
    markerRef.current?.setLatLng([r.lat, r.lng]);
  };

  const confirm = () => {
    if (!picked) return;
    onConfirm(picked.lat, picked.lng);
    setPickerOpen(false);
    setFullscreen(false);
  };

  if (!pickerOpen) {
    return (
      <button type="button" onClick={() => setPickerOpen(true)} className="flex w-full items-center gap-2 rounded-xl bg-primary-light px-3.5 py-3 text-left">
        <Ionicon name="location" size={16} color={colors.primaryDark} />
        <span className="line-clamp-2 flex-1 text-sm font-semibold text-primary-dark">{confirming ? "Saving location…" : selectedLabel || "Tap to set a location"}</span>
        <Ionicon name="create-outline" size={17} color={colors.primaryDark} />
      </button>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[95] flex flex-col bg-surface" : ""}>
      {fullscreen && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-base font-bold text-ink">Pick a location</span>
          <button type="button" aria-label="Close full screen" onClick={() => setFullscreen(false)}>
            <Ionicon name="close" size={24} color={colors.ink} />
          </button>
        </div>
      )}
      <div className={fullscreen ? "flex min-h-0 flex-1 flex-col p-3" : ""}>
        <div className="relative">
          <label className="mb-2 flex items-center gap-2 rounded-xl border-[1.5px] border-border bg-surface px-3.5 focus-within:border-primary">
            <Ionicon name="search-outline" size={18} color={colors.muted} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a place..."
              aria-label="Search for a place"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted"
            />
            {searching ? (
              <Spinner size={18} />
            ) : query ? (
              <button type="button" aria-label="Clear" onClick={() => (setQuery(""), setResults([]))}>
                <Ionicon name="close-circle" size={20} color={colors.muted} />
              </button>
            ) : null}
          </label>
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-[1001] -mt-1 overflow-hidden rounded-xl border-[1.5px] border-border bg-surface shadow-card">
              {results.map((r, i) => (
                <button key={`${r.lat}-${r.lng}-${i}`} type="button" onClick={() => pickResult(r)} className="flex w-full items-center gap-2 border-b border-border px-3.5 py-3 text-left last:border-0 hover:bg-gray-50">
                  <Ionicon name="location-outline" size={16} color={colors.muted} />
                  <span className="line-clamp-2 flex-1 text-xs text-ink">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* No map (and no loader) until a center is known — just the search above. */}
        {hasCenter && (
          <div className={`relative overflow-hidden rounded-2xl ${fullscreen ? "min-h-0 flex-1" : "h-[260px] shadow-card"}`}>
            <div ref={mapEl} className="absolute inset-0 z-0" />
            {!fullscreen && (
              <button
                type="button"
                aria-label="Full screen map"
                onClick={() => setFullscreen(true)}
                className="absolute right-3 top-3 z-[1000] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface shadow-card"
              >
                <Ionicon name="expand-outline" size={16} color={colors.ink} />
              </button>
            )}
            <button type="button" onClick={confirm} disabled={confirming} className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-cta">
              {confirming ? (
                <Spinner color="white" />
              ) : (
                <>
                  <Ionicon name="checkmark" size={18} color="white" />
                  Use This Location
                </>
              )}
            </button>
          </div>
        )}

        {selectedLabel && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-primary-light px-3.5 py-2.5 text-xs font-semibold text-primary-dark">
            <Ionicon name="location" size={15} color={colors.primaryDark} />
            <span className="line-clamp-2 flex-1">{selectedLabel}</span>
          </p>
        )}
      </div>
    </div>
  );
}
