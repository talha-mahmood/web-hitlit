import type { TeamChallengeFormat } from "./api/teamChallenges";

export type ChallengeFormatOption = { value: TeamChallengeFormat; label: string };

const optionsBySport: Record<string, ChallengeFormatOption[]> = {
  football: [
    { value: "5v5", label: "5v5" },
    { value: "7v7", label: "7v7" },
    { value: "11v11", label: "11v11" },
  ],
  "hard ball": [
    { value: "T10", label: "T10" },
    { value: "T20", label: "T20" },
    { value: "ODI", label: "One Day" },
    { value: "Club", label: "Club Cricket" },
  ],
  "tape ball": [
    { value: "T10", label: "T10" },
    { value: "T20", label: "T20" },
    { value: "ODI", label: "One Day" },
    { value: "Club", label: "Club Cricket" },
  ],
  "outdoor cricket": [
    { value: "T10", label: "T10" },
    { value: "T20", label: "T20" },
    { value: "ODI", label: "One Day" },
    { value: "Club", label: "Club Cricket" },
  ],
  cricket: [
    { value: "T10", label: "T10" },
    { value: "T20", label: "T20" },
    { value: "ODI", label: "One Day" },
    { value: "Club", label: "Club Cricket" },
  ],
  padel: [
    { value: "SINGLES", label: "Singles" },
    { value: "DOUBLES", label: "Doubles" },
  ],
  tennis: [
    { value: "SINGLES", label: "Singles" },
    { value: "DOUBLES", label: "Doubles" },
  ],
  badminton: [
    { value: "SINGLES", label: "Singles" },
    { value: "DOUBLES", label: "Doubles" },
  ],
  pickleball: [
    { value: "SINGLES", label: "Singles" },
    { value: "DOUBLES", label: "Doubles" },
  ],
  "table tennis": [
    { value: "SINGLES", label: "Singles" },
    { value: "DOUBLES", label: "Doubles" },
  ],
};

export function challengeFormatsForSport(name: string | null | undefined): ChallengeFormatOption[] {
  return optionsBySport[(name ?? "").trim().toLowerCase()] ?? [];
}

export function scorecardTableForSport(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (["hard ball", "tape ball", "outdoor cricket", "cricket"].includes(key)) return "cricket_matches";
  const tables: Record<string, string> = {
    football: "football_matches",
    padel: "padel_matches",
    tennis: "tennis_matches",
    badminton: "badminton_matches",
    pickleball: "pickleball_matches",
    "table tennis": "table_tennis_matches",
  };
  return tables[key] ?? null;
}
