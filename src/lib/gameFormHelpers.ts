export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getNext14Days(): { iso: string; label: string; day: string }[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      iso: toLocalDateStr(d),
      label: String(d.getDate()),
      day: d.toLocaleDateString("en-PK", { weekday: "short" }),
    };
  });
}

// Half-hour slots from 06:00 to 23:00
export function buildTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const suffix = h < 12 ? "AM" : h === 12 ? "PM" : "PM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      slots.push({ label: `${displayH}:${mm} ${suffix}`, value: `${hh}:${mm}` });
    }
  }
  return slots;
}

export function addMinutes(timeValue: string, minutes: number): string {
  const [hh, mm] = timeValue.split(":").map(Number);
  const total = hh * 60 + mm + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// Hours between two 'HH:MM' values, rounded to the nearest supported DURATIONS step.
export function diffHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return Math.round((minutes / 60) * 2) / 2; // nearest 0.5
}

export const TIME_SLOTS = buildTimeSlots();
export const DAYS = getNext14Days();
export const DURATIONS = [1, 1.5, 2, 2.5, 3] as const;
export const MAX_PLAYERS_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
