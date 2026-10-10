// Pulls lat/lng straight out of a Google Maps URL so a venue owner only
// ever has to paste one link — no separate coordinate fields to fill in.
//
// Google Maps encodes coordinates differently depending on how the link was
// generated, so try each known shape in turn:
//   - /@lat,lng,zoom   — the most common "standard" map view URL
//   - !3d<lat>!4d<lng> — the exact pin, found in long "share this place" URLs
//   - q=/ll=/sll=lat,lng — older/alternate query-string forms
function extractLatLngFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|ll|sll)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

const SHORT_LINK_HOSTS = ["goo.gl", "maps.app.goo.gl", "app.goo.gl"];

function isShortLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SHORT_LINK_HOSTS.includes(host);
  } catch {
    return false;
  }
}

// Short links (goo.gl / maps.app.goo.gl) don't carry coordinates in the URL
// itself — they only appear after the redirect resolves to the real Google
// Maps URL. `fetch` follows redirects by default and exposes the final
// landed-on address via `response.url`, so a plain request is enough.
async function resolveShortLink(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.url || url;
  } catch {
    return url;
  }
}

// Returns null if no coordinates could be found anywhere in the link (or
// its resolved form) — the caller should treat that as "invalid link".
export async function extractCoordsFromGoogleMapsLink(rawUrl: string): Promise<{ lat: number; lng: number } | null> {
  const url = rawUrl.trim();
  if (!url) return null;

  const direct = extractLatLngFromUrl(url);
  if (direct) return direct;

  if (isShortLink(url)) {
    const resolved = await resolveShortLink(url);
    return extractLatLngFromUrl(resolved);
  }

  return null;
}
