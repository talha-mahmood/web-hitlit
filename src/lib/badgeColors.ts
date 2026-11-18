import { colors } from "../constants/theme";

// Solid, fully-saturated pills for skill level (not pale tints) — reads
// closer to a real badge at a glance. Shared between list cards and detail
// screens so the same skill always reads the same color everywhere.
export const GAME_SKILL_COLORS: Record<string, string> = {
  BEGINNER: colors.primary,
  INTERMEDIATE: "#EAB308",
  ADVANCED: "#EC4899",
  PRO: "#8B5CF6",
};

export const SQUAD_SKILL_COLORS: Record<string, string> = {
  beginner: colors.primary,
  intermediate: "#EAB308",
  expert: "#EC4899",
};

// The time badge's color varies with time of day — a small, tasteful dose
// of color variety rather than one flat tint everywhere.
export function timeBadgeColor(startTime: string): string {
  const hour = parseInt(startTime.slice(0, 2), 10);
  if (hour >= 5 && hour < 12) return "#F59E0B"; // morning
  if (hour >= 12 && hour < 17) return "#0EA5E9"; // afternoon
  if (hour >= 17 && hour < 21) return "#6366F1"; // evening
  return "#2563EB"; // night
}

// "Today" / "Tomorrow" / "Sat, Aug 16" — used to prefix a time badge so a
// list (or detail page) spanning many days doesn't lose which day something falls on.
export function dayLabel(dateStr: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric" });
}
