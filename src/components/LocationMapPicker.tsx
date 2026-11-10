import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, TextInput, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../constants/theme";
import { getDeviceCoordsForMapCenter, reverseGeocodeViaNominatim, PAKISTAN_DEFAULT_CENTER } from "../lib/locationPicker";
import GradientFill from "./GradientFill";

// A small, self-contained Leaflet + OpenStreetMap page, loaded straight
// into the WebView as an HTML string (no separate asset file, no API key —
// OSM's tile server is free to use at this scale). The marker starts at
// (initialLat, initialLng) and can be dragged or placed by tapping
// anywhere on the map; every move posts the new {lat, lng} back to RN.
// `map`/`marker`/`post` are left as plain globals (no IIFE wrapper) so a
// search result picked on the RN side can move them via injectJavaScript
// without reloading the page.
function buildMapHtml(initialLat: number, initialLng: number): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${initialLat}, ${initialLng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    var marker = L.marker([${initialLat}, ${initialLng}], { draggable: true }).addTo(map);
    function post(latlng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
    }
    marker.on('dragend', function (e) { post(e.target.getLatLng()); });
    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      post(e.latlng);
    });
    post(marker.getLatLng());
  </script>
</body>
</html>`;
}

type SearchResult = { label: string; lat: number; lng: number };

export default function LocationMapPicker({
  initialLat,
  initialLng,
  onConfirm,
  confirming,
  selectedLabel,
}: {
  // Optional — when omitted, the picker detects the device's current
  // location in the background (falling back to PAKISTAN_DEFAULT_CENTER on
  // denial/failure) instead of requiring the caller to pre-fetch it.
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
  confirming: boolean;
  // The host's last confirmed pick (set by the caller once onConfirm's own
  // address lookup resolves) — shown below the map in both the embedded and
  // full-screen views, since the full-screen one is a modal the caller's
  // own layout can't reach to show it there itself.
  selectedLabel?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const hasInitialCoords = initialLat != null && initialLng != null;
  // `picked` stays null until a center is known (either given by the
  // caller, or auto-detected below) — the map box itself doesn't render
  // until then, so there's nothing to show a loader for: the search field
  // above renders immediately regardless of this being null.
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    hasInitialCoords ? { lat: initialLat!, lng: initialLng! } : null
  );
  const autoDetectStarted = useRef(hasInitialCoords);
  useEffect(() => {
    if (autoDetectStarted.current) return;
    autoDetectStarted.current = true;
    (async () => {
      const coords = await getDeviceCoordsForMapCenter();
      setPicked(
        coords
          ? { lat: coords.latitude, lng: coords.longitude }
          : { lat: PAKISTAN_DEFAULT_CENTER.latitude, lng: PAKISTAN_DEFAULT_CENTER.longitude }
      );
    })();
  }, []);

  // Flips once the WebView's underlying page finishes loading — the map
  // itself (WebView) only mounts once `picked` is known, and stays
  // invisible (opacity 0, but still mounted so it loads in the background)
  // until this is also true, so it only ever appears fully ready, never as
  // an empty map that fills in afterward.
  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const hasCenter = picked !== null;
  // Reseeded from the current pin position (not the original initial props)
  // whenever fullscreen is toggled on or off, so switching views never loses
  // whatever the host already picked. Only recomputed on that transition
  // (and once, when a center first becomes known) — the map then tracks
  // drags/taps/search picks live via injectJavaScript, same as it always
  // has, without needing a fresh HTML load for those.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => (picked ? buildMapHtml(picked.lat, picked.lng) : null), [fullscreen, hasCenter]);
  const webviewRef = useRef<WebView>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  // Guards against a slower, older request's results landing after a
  // newer one's and clobbering what's on screen.
  const searchRequestId = useRef(0);
  // Picking a search result already sets the box to that result's own
  // label (see handlePickResult) — skip the next reverse-geocode sync so it
  // isn't immediately overwritten by a (usually near-identical, but
  // possibly differently worded) address for the same coordinates.
  const skipNextGeocodeSync = useRef(false);
  const geocodeSyncRequestId = useRef(0);
  // De-dupes reverse-geocode syncs for a coordinate pair already synced —
  // the map reposts the marker's current position on every load/reload
  // (initial load, fullscreen toggle), which would otherwise re-geocode the
  // exact same point it just did moments earlier.
  const lastGeocodedKey = useRef<string | null>(null);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number };
      setPicked(data);
    } catch {
      // Ignore anything that isn't the {lat,lng} shape we post.
    }
  };

  // Keeps the search box showing wherever the pin currently is — like
  // Google Maps' search bar echoing the selected place — whenever it moves,
  // whether because a center was just auto-detected, the host dragged or
  // tapped the map, or the map reposted the same point on load/reload (not
  // because a search result was picked, which already set a label directly).
  useEffect(() => {
    if (!picked) return;
    const key = `${picked.lat},${picked.lng}`;
    if (skipNextGeocodeSync.current) {
      skipNextGeocodeSync.current = false;
      lastGeocodedKey.current = key;
      return;
    }
    if (key === lastGeocodedKey.current) return;
    lastGeocodedKey.current = key;
    const requestId = ++geocodeSyncRequestId.current;
    reverseGeocodeViaNominatim(picked.lat, picked.lng)
      .then((label) => {
        if (requestId === geocodeSyncRequestId.current) setQuery(label);
      })
      .catch(() => {
        // Best-effort — leave whatever text is already in the box.
      });
  }, [picked]);

  // OSM's own free geocoder — no API key, same OSM ecosystem the tiles
  // already come from. A User-Agent is required by Nominatim's usage
  // policy; fetch lets us set one from React Native. Restricted to
  // Pakistan (countrycodes=pk) — this app is Pakistan-only, so a result in
  // another country is never useful here.
  const handleSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const requestId = ++searchRequestId.current;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5&countrycodes=pk`,
        { headers: { "User-Agent": "HitLit-App/1.0", "Accept-Language": "en" } }
      );
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      if (requestId !== searchRequestId.current) return;
      setResults(data.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
    } catch {
      if (requestId === searchRequestId.current) setResults([]);
    } finally {
      if (requestId === searchRequestId.current) setSearching(false);
    }
  };

  // Live-as-you-type, like Google Maps — debounced so it fires once typing
  // pauses instead of on every keystroke.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => handleSearch(query), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handlePickResult = (r: SearchResult) => {
    setResults([]);
    setQuery(r.label);
    skipNextGeocodeSync.current = true;
    setPicked({ lat: r.lat, lng: r.lng });
    // Moves the already-loaded map/marker in place — map/marker/post are
    // plain globals in the page's own script (see buildMapHtml), so no
    // reload is needed.
    webviewRef.current?.injectJavaScript(
      `(function(){ var ll = { lat: ${r.lat}, lng: ${r.lng} }; map.setView(ll, 15); marker.setLatLng(ll); post(ll); })(); true;`
    );
  };

  // Reloads the map at its current size (the WebView's `source` prop
  // changing re-triggers its loading state) — hidden again via
  // `webviewLoaded` until that reload finishes, same as the very first load.
  const toggleFullscreen = () => {
    setWebviewLoaded(false);
    setFullscreen((f) => !f);
  };

  const pickerBody = (
    <View style={fullscreen ? { flex: 1 } : undefined}>
      <View className="flex-row items-center bg-surface rounded-xl px-3.5 mb-2" style={{ borderWidth: 1.5, borderColor: colors.border, gap: 8 }}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => handleSearch(query)}
          returnKeyType="search"
          placeholder="Search for a place..."
          placeholderTextColor={colors.muted}
          className="flex-1 text-ink text-sm"
          style={{ paddingVertical: 12 }}
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => {
              setQuery("");
              setResults([]);
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {results.length > 0 && (
        <View className="bg-surface rounded-xl mb-2" style={{ borderWidth: 1.5, borderColor: colors.border, ...cardShadow }}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.lat}-${r.lng}-${i}`}
              onPress={() => handlePickResult(r)}
              className="flex-row items-center px-3.5 py-3"
              style={i < results.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 } : { gap: 8 }}
            >
              <Ionicons name="location-outline" size={16} color={colors.muted} />
              <Text className="flex-1 text-ink text-xs" numberOfLines={2}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* The whole map box stays unmounted (not just invisible) until a
          center is known — nothing renders here while auto-detect runs, by
          design: no loader, just the search field above until this is
          ready. Once `html` exists, the WebView mounts and loads in the
          background (opacity 0) and only fades in once `webviewLoaded`, so
          it's never shown mid-load or centered on the wrong point. */}
      {picked && html && (
        <View
          className="rounded-2xl overflow-hidden"
          style={fullscreen ? { flex: 1 } : { height: 260, ...cardShadow }}
        >
          <WebView
            ref={webviewRef}
            source={{ html }}
            onMessage={handleMessage}
            onLoadEnd={() => setWebviewLoaded(true)}
            style={{ flex: 1, opacity: webviewLoaded ? 1 : 0 }}
          />
          {/* Only in the embedded view — the full-screen view exits via its
              own header's close button instead. */}
          {!fullscreen && webviewLoaded && (
            <Pressable
              onPress={toggleFullscreen}
              hitSlop={6}
              className="absolute top-3 right-3 items-center justify-center"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, ...cardShadow }}
            >
              <Ionicons name="expand-outline" size={16} color={colors.ink} />
            </Pressable>
          )}
          {webviewLoaded && (
            <Pressable
              onPress={() => onConfirm(picked.lat, picked.lng)}
              disabled={confirming}
              className="absolute bottom-3 left-3 right-3"
              style={primaryButtonShadow}
            >
              <GradientFill className="flex-row items-center justify-center rounded-xl py-3" style={{ gap: 8 }}>
                {confirming ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="white" />
                    <Text className="text-jazba-white font-bold text-sm">Use This Location</Text>
                  </>
                )}
              </GradientFill>
            </Pressable>
          )}
        </View>
      )}

      {selectedLabel && (
        <View className="flex-row items-center rounded-xl px-3.5 py-2.5 mt-2" style={{ backgroundColor: colors.primaryLight, gap: 8 }}>
          <Ionicons name="location" size={15} color={colors.primaryDark} />
          <Text className="flex-1 text-xs font-semibold" style={{ color: colors.primaryDark }} numberOfLines={2}>
            {selectedLabel}
          </Text>
        </View>
      )}
    </View>
  );

  if (fullscreen) {
    return (
      <Modal visible animationType="slide" onRequestClose={toggleFullscreen}>
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
          <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text className="text-ink font-bold text-base">Pick a location</Text>
            <Pressable onPress={toggleFullscreen} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <View style={{ flex: 1, padding: 12, paddingBottom: insets.bottom + 12 }}>{pickerBody}</View>
        </View>
      </Modal>
    );
  }

  return pickerBody;
}
