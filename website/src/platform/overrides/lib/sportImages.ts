import badminton from "@/assets/web/sport-badminton.webp";
import football from "@/assets/web/sport-football.webp";
import outdoorCricket from "@/assets/web/sport-outdoor-cricket.webp";
import boxCricket from "@/assets/web/sport-box-cricket.webp";
import padel from "@/assets/web/sport-padel.webp";
import pickleball from "@/assets/web/sport-pickleball.webp";
import tableTennis from "@/assets/web/sport-table-tennis.webp";
import tennis from "@/assets/web/sport-tennis.webp";
import padelCard from "@/assets/web/sport-padel-card.webp";

// Web version of src/lib/sportImages.ts — same (transparent-background) photos and the same name
// mapping, imported as bundled URLs instead of RN `require()` assets. Returns
// the same `{ uri }` shape the app uses for remote images.
const SPORT_IMAGES: Record<string, { uri: string }> = {
  badminton: { uri: badminton },
  football: { uri: football },
  futsal: { uri: football },
  cricket: { uri: outdoorCricket },
  "hard ball": { uri: outdoorCricket },
  "tape ball": { uri: boxCricket },
  padel: { uri: padel },
  pickleball: { uri: pickleball },
  "table tennis": { uri: tableTennis },
  tennis: { uri: tennis },
};

export function getSportImage(sportName: string): { uri: string } | null {
  return SPORT_IMAGES[sportName.trim().toLowerCase()] ?? null;
}

// Tighter, near-square padel crop for small game/tournament card thumbnails
// (same as the app's getSportCardThumb); every other sport uses its photo.
const SPORT_CARD_THUMBS: Record<string, { uri: string }> = {
  padel: { uri: padelCard },
};

export function getSportCardThumb(sportName: string): { uri: string } | null {
  const key = sportName.trim().toLowerCase();
  return SPORT_CARD_THUMBS[key] ?? getSportImage(key);
}
