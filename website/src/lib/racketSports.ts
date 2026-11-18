import type { MatchSport } from "@/routes/paths";

// The five point/rally scorecard sports. `key` is the URL / MatchSport slug.
export type RacketSportKey = "padel" | "tennis" | "pickleball" | "badminton" | "table_tennis";

export type RacketSportMeta = {
  key: RacketSportKey;
  title: string;
  // getSportImage / getSportIcon key
  imageKey: string;
  // MaterialCommunityIcons glyph inside the team crest
  crestIcon: string;
  // big glyph in the list's empty-state disc
  emptyIcon: string;
  // faint watermark on the scoring buttons (Ionicons)
  watermarkIcon: string;
};

export const RACKET_SPORTS: Record<RacketSportKey, RacketSportMeta> = {
  padel: { key: "padel", title: "Padel", imageKey: "padel", crestIcon: "racquetball", emptyIcon: "tennis", watermarkIcon: "tennisball-outline" },
  tennis: { key: "tennis", title: "Tennis", imageKey: "tennis", crestIcon: "tennis", emptyIcon: "tennis-ball", watermarkIcon: "tennisball-outline" },
  pickleball: { key: "pickleball", title: "Pickleball", imageKey: "pickleball", crestIcon: "table-tennis", emptyIcon: "racquetball", watermarkIcon: "disc-outline" },
  badminton: { key: "badminton", title: "Badminton", imageKey: "badminton", crestIcon: "badminton", emptyIcon: "badminton", watermarkIcon: "disc-outline" },
  table_tennis: { key: "table_tennis", title: "Table Tennis", imageKey: "table tennis", crestIcon: "table-tennis", emptyIcon: "table-tennis", watermarkIcon: "disc-outline" },
};

export function isRacketSport(sport: string | undefined): sport is RacketSportKey {
  return !!sport && sport in RACKET_SPORTS;
}

export function isMatchSport(sport: string | undefined): sport is MatchSport {
  return !!sport && (sport === "cricket" || sport === "football" || isRacketSport(sport));
}
