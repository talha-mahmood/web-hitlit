import { useState, type FormEvent } from "react";
import { Ionicon } from "@/components/icons/Icon";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";

type Category = "venues" | "games" | "tournaments" | "squads" | "events";

const CATEGORIES: { key: Category; label: string; icon: string; placeholder: string; sport: boolean }[] = [
  { key: "venues", label: "Venues", icon: "location-outline", placeholder: "Search venues or areas…", sport: true },
  { key: "games", label: "Games", icon: "tennisball-outline", placeholder: "Search games…", sport: true },
  { key: "tournaments", label: "Tournaments", icon: "trophy-outline", placeholder: "Search tournaments…", sport: true },
  { key: "squads", label: "Squads", icon: "people-outline", placeholder: "Search squads and teams…", sport: false },
  { key: "events", label: "Events", icon: "calendar-outline", placeholder: "Search events…", sport: false },
];

// Where a search goes: the section's own list page with its existing
// `q` (search text) and `sport` URL filters.
function searchUrl(category: Category, q: string, sportId: string) {
  const params = new URLSearchParams();
  if (category === "tournaments") params.set("type", "TOURNAMENT");
  if (sportId && (category === "venues" || category === "games" || category === "tournaments")) params.set("sport", sportId);
  if (q.trim()) params.set("q", q.trim());
  const base = { venues: "/venues", games: "/games", tournaments: "/games", squads: paths.squads, events: "/events" }[category];
  const s = params.toString();
  return `${base}${s ? `?${s}` : ""}`;
}

export type HeroStat = { label: string; value: number; loading: boolean; icon: string; to: string };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// The signed-in home's hero: a personal headline, a search box that sends
// you to the right list page (venues, games, tournaments, squads, events)
// with the search text and sport applied, popular sports, and a "near you"
// panel with live counts.
export default function HomeHero({
  firstName,
  sports,
  stats,
}: {
  firstName?: string;
  sports: { id: string; name: string }[];
  stats: HeroStat[];
}) {
  const navigate = useAppNavigate();
  const [category, setCategory] = useState<Category>("venues");
  const [query, setQuery] = useState("");
  const [sportId, setSportId] = useState("");
  const current = CATEGORIES.find((c) => c.key === category)!;

  const go = (url: string) => navigate(url, category === "venues" ? { state: { tab: "venues" } } : undefined);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(searchUrl(category, query, sportId));
  };

  return (
    <section className="relative overflow-hidden bg-[#062A19]">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-56 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(34,197,94,0.28),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-72 -left-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(24,198,106,0.16),transparent)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
      />

      <div className="site-container relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.35fr_1fr] lg:gap-14 lg:py-16">
        <div className="min-w-0 animate-fadeUp">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15">
            <span aria-hidden>👋</span>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-4 text-[32px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[44px] lg:text-[50px]">
            What do you want to <span className="text-[#4ADE80]">play</span> today?
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/85 sm:text-lg">Search venues, games, squads and events near you.</p>

          <form onSubmit={submit} role="search" aria-label="Search HitLit" className="mt-7">
            <div role="tablist" aria-label="Search in" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-3">
              {CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(c.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active ? "bg-white text-[#062A19]" : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Ionicon name={c.icon} size={16} color={active ? "#0B7A45" : "rgba(255,255,255,0.85)"} />
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3">
                <Ionicon name="search-outline" size={20} color="#64748B" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={current.placeholder}
                  aria-label={current.placeholder.replace("…", "")}
                  className="h-12 w-full min-w-0 bg-transparent text-[15px] text-[#0F172A] outline-none placeholder:text-[#64748B]"
                />
              </label>
              {current.sport && (
                <label className="flex items-center gap-2 border-t border-[#E2E8F0] px-3 pt-2 sm:border-l sm:border-t-0 sm:pt-0">
                  <Ionicon name="football-outline" size={18} color="#64748B" />
                  <select
                    value={sportId}
                    onChange={(e) => setSportId(e.target.value)}
                    aria-label="Sport"
                    className="h-11 w-full cursor-pointer bg-transparent pr-1 text-[15px] font-medium text-[#0F172A] outline-none sm:w-40"
                  >
                    <option value="">All sports</option>
                    {sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className="press flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-bold text-white shadow-cta transition hover:brightness-110">
                <Ionicon name="search" size={17} color="white" />
                Search
              </button>
            </div>
          </form>

          {current.sport && sports.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white/75">Popular:</span>
              {sports.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(searchUrl(category, "", s.id))}
                  className="rounded-full border border-white/20 px-3 py-1 text-[13px] font-medium text-white/90 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Near you right now</h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#86EFAC]">
              <span className="h-2 w-2 animate-skeleton rounded-full bg-[#4ADE80]" />
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => navigate(s.to)}
                className="group rounded-2xl bg-white/[0.07] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:ring-white/25"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4ADE80]/15">
                  <Ionicon name={s.icon} size={18} color="#4ADE80" />
                </span>
                <span className="mt-3 block text-2xl font-extrabold text-white sm:text-[28px]">{s.loading ? "–" : s.value}</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-white/80">
                  {s.label}
                  <Ionicon name="arrow-forward" size={13} color="rgba(255,255,255,0.7)" className="opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-white/70">
            <Ionicon name="information-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
            Sorted nearest first when location is on.
          </p>
        </div>
      </div>
    </section>
  );
}

