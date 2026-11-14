import badminton from "@/assets/web/sport-badminton-lg.webp";
import football from "@/assets/web/sport-football-lg.webp";
import outdoorCricket from "@/assets/web/sport-outdoor-cricket-lg.webp";
import boxCricket from "@/assets/web/sport-box-cricket-lg.webp";
import padel from "@/assets/web/sport-padel-lg.webp";
import pickleball from "@/assets/web/sport-pickleball-lg.webp";
import tableTennis from "@/assets/web/sport-table-tennis-lg.webp";
import tennis from "@/assets/web/sport-tennis-lg.webp";

// Same name → photo mapping as the app's sportImages.ts, at a resolution
// suitable for full-width heroes (the default web copies are tile-sized).
const LARGE: Record<string, string> = {
  badminton,
  football,
  futsal: football,
  cricket: outdoorCricket,
  "hard ball": outdoorCricket,
  "tape ball": boxCricket,
  padel,
  pickleball,
  "table tennis": tableTennis,
  tennis,
};

export function getSportImageLarge(sportName: string): string | undefined {
  return LARGE[sportName.trim().toLowerCase()];
}
