import { supabase } from "../../lib/supabase";

export type VisualAssetKind =
  | "team"
  | "squad"
  | "tournament"
  | "league"
  | "event"
  | "game"
  | "challenge"
  | "player"
  | "sport"
  | "activity";

export type VisualAssetInput = {
  id?: string;
  name: string;
  sport?: string | null;
  kind: VisualAssetKind;
  seed?: string;
};

export const GENERATED_ASSET_VERSION = 1;

const palettes = [
  ["#0B2545", "#147D92", "#F5C451"],
  ["#172554", "#2563EB", "#F8FAFC"],
  ["#064E3B", "#10B981", "#FDE68A"],
  ["#3B174A", "#A855F7", "#FDE68A"],
  ["#7C2D12", "#EA580C", "#FEF3C7"],
  ["#17202A", "#D4AF37", "#F8FAFC"],
  ["#831843", "#EC4899", "#FCE7F3"],
  ["#134E4A", "#14B8A6", "#ECFEFF"],
  ["#312E81", "#818CF8", "#FDE68A"],
  ["#3F3F46", "#A1A1AA", "#FAFAFA"],
  ["#14532D", "#22C55E", "#FEF08A"],
  ["#7F1D1D", "#DC2626", "#FECACA"],
] as const;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      default: return "&apos;";
    }
  });
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "HL";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(words[0])[0] ?? ""}${Array.from(words[words.length - 1])[0] ?? ""}`.toUpperCase();
}

function sportSymbol(sport: string, primary: string, accent: string, kind: VisualAssetKind): string {
  const s = sport.toLowerCase();
  if (kind === "tournament" || kind === "league") {
    return `<path d="M72 38h56v12c0 22-10 36-28 39-18-3-28-17-28-39z" fill="${accent}"/><path d="M72 46H58v8c0 14 8 22 23 23M128 46h14v8c0 14-8 22-23 23M100 89v13m-18 5h36" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><path d="M88 53l12-8 12 8-4 14h-16z" fill="${primary}"/>`;
  }
  if (s.includes("cricket") || s.includes("tape ball") || s.includes("hard ball")) {
    return `<path d="M79 43l11-4 10 51-11 3zM102 40l11 3-5 52-11-1zM121 43l11 3-12 49-11-3z" fill="${accent}"/><circle cx="100" cy="63" r="11" fill="#D94343"/><path d="M96 54q8 9 0 18" fill="none" stroke="#7F1D1D" stroke-width="2"/>`;
  }
  if (s.includes("padel") || s.includes("tennis") || s.includes("pickle") || s.includes("badminton") || s.includes("racket") || s.includes("table tennis")) {
    return `<ellipse cx="90" cy="58" rx="21" ry="28" transform="rotate(34 90 58)" fill="none" stroke="${accent}" stroke-width="9"/><path d="M105 78l28 25-8 8-29-25" fill="${accent}"/><circle cx="127" cy="43" r="9" fill="#D6F06B"/><path d="M76 48l28 21m-32-10 28 20m-20-39 27 22" stroke="${primary}" stroke-width="2.5" opacity=".85"/>`;
  }
  if (s.includes("basket")) {
    return `<circle cx="100" cy="65" r="34" fill="${accent}"/><path d="M66 65h68M100 31c-18 17-18 51 0 68m0-68c18 17 18 51 0 68M75 42c24 10 26 36 0 47m50-47c-24 10-26 36 0 47" fill="none" stroke="${primary}" stroke-width="4"/>`;
  }
  if (s.includes("football") || s.includes("soccer")) {
    return `<circle cx="100" cy="64" r="34" fill="${accent}"/><path d="M100 46l15 11-6 18H91l-6-18zM100 30v16m-30 4 15 7m30 0 15-7M74 82l17-7m18 0 17 7m-42 13 8-13m20 0 8 13" fill="none" stroke="${primary}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  if (s.includes("run") || s.includes("fitness") || s.includes("athlet")) {
    return `<circle cx="112" cy="39" r="10" fill="${accent}"/><path d="M99 52l-16 18 18 7 12-15 20 10m-34-12 12 18-15 23m3-26-22 18m36-19 18 27" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M69 40h18M61 54h16M56 68h12" stroke="${primary}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (s.includes("adventure") || s.includes("hike") || s.includes("outdoor") || s.includes("camp")) {
    return `<path d="M55 91l31-49 18 27 15-20 27 42z" fill="${accent}"/><path d="M82 91l30-39 31 39z" fill="${primary}"/><path d="M86 57l-8 13 11-4 6 6 7-11z" fill="#F8FAFC"/>`;
  }
  return `<path d="M67 74c14-30 52-42 69-18-2 28-28 49-57 43-11-4-16-13-12-25z" fill="${accent}"/><circle cx="88" cy="64" r="6" fill="${primary}"/><circle cx="111" cy="53" r="5" fill="${primary}"/><circle cx="120" cy="77" r="7" fill="${primary}"/><path d="M72 96l55-51" stroke="${primary}" stroke-width="4" opacity=".8"/>`;
}

/** Deterministically creates a trusted, sanitized SVG from our own templates. */
export function generateVisualAsset(input: VisualAssetInput): string {
  const base = `${input.kind}|${input.id ?? ""}|${input.seed ?? ""}|${input.name}|${input.sport ?? ""}`;
  const hash = hashSeed(base);
  const [dark, bright, accent] = palettes[hash % palettes.length];
  const template = (hash >>> 5) % 4;
  const label = initials(input.name);
  const safeName = escapeXml(input.name.trim().slice(0, 28));
  const safeSport = escapeXml((input.sport ?? "SPORT").trim().slice(0, 18).toUpperCase());
  const isPlayer = input.kind === "player";
  const shell = isPlayer
    ? `<circle cx="100" cy="100" r="95" fill="url(#bg)" stroke="${accent}" stroke-width="5"/><circle cx="100" cy="100" r="80" fill="none" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="2"/>`
    : template === 0
      ? `<path d="M100 6L174 31v57c0 48-31 81-74 102-43-21-74-54-74-102V31z" fill="url(#bg)" stroke="${accent}" stroke-width="6"/><path d="M100 17L162 38v49c0 39-24 67-62 86-38-19-62-47-62-86V38z" fill="none" stroke="#FFFFFF" stroke-opacity=".68" stroke-width="3"/>`
      : template === 1
        ? `<circle cx="100" cy="100" r="91" fill="url(#bg)" stroke="${accent}" stroke-width="7"/><circle cx="100" cy="100" r="76" fill="none" stroke="#FFFFFF" stroke-opacity=".72" stroke-width="3"/><path d="M25 100h150" stroke="${accent}" stroke-width="2" opacity=".65"/>`
        : template === 2
          ? `<path d="M100 7l81 46v88l-81 46-81-46V53z" fill="url(#bg)" stroke="${accent}" stroke-width="6"/><path d="M100 22l66 38v72l-66 38-66-38V60z" fill="none" stroke="#FFFFFF" stroke-opacity=".62" stroke-width="3"/>`
          : `<path d="M29 18h142v65c0 45-25 78-71 100-46-22-71-55-71-100z" fill="url(#bg)" stroke="${accent}" stroke-width="6"/><path d="M43 31h114v52c0 36-20 63-57 82-37-19-57-46-57-82z" fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="3"/>`;

  const motif = sportSymbol(input.sport ?? input.name, bright, accent, input.kind);
  const initialsY = isPlayer ? 144 : 150;
  const motifOpacity = isPlayer ? 0.58 : 0.94;
  const stars = input.kind === "team" || input.kind === "tournament" || input.kind === "league"
    ? `<path d="M54 34l2.2 5.5 5.8.4-4.5 3.7 1.5 5.6-5-3.1-5 3.1 1.5-5.6-4.5-3.7 5.8-.4zM146 34l2.2 5.5 5.8.4-4.5 3.7 1.5 5.6-5-3.1-5 3.1 1.5-5.6-4.5-3.7 5.8-.4z" fill="${accent}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="${safeName}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${bright}"/></linearGradient></defs>${shell}<g opacity="${motifOpacity}">${motif}</g>${stars}<text x="100" y="${initialsY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${isPlayer ? 54 : 38}" font-weight="700" letter-spacing="1" fill="#FFFFFF" stroke="${dark}" stroke-width="1.5" paint-order="stroke">${escapeXml(label)}</text>${!isPlayer ? `<text x="100" y="172" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing="1.2" fill="#FFFFFF">${safeSport}</text>` : `<circle cx="100" cy="100" r="91" fill="none" stroke="${accent}" stroke-width="2"/>`}</svg>`;
}

function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(bytes);
}

export async function saveGeneratedVisualAsset(
  input: VisualAssetInput,
  options: { bucket: string; folder: string },
): Promise<string> {
  if (!input.id) throw new Error("An entity ID is required to save its generated visual asset.");
  const svg = generateVisualAsset(input);
  // Content-address the filename so repeated saves are idempotent while a
  // renamed entity can receive a fresh generated badge without overwriting
  // the previously cached SVG in object storage.
  const path = `${options.folder}/generated-v${GENERATED_ASSET_VERSION}-${hashSeed(svg).toString(36)}.svg`;
  const { error } = await supabase.storage.from(options.bucket).upload(path, encodeUtf8(svg), {
    contentType: "image/svg+xml",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    const message = error.message.toLowerCase();
    const alreadyExists = Number(error.statusCode) === 409 || message.includes("already exists") || message.includes("duplicate");
    if (!alreadyExists) throw error;
  }
  return supabase.storage.from(options.bucket).getPublicUrl(path).data.publicUrl;
}
