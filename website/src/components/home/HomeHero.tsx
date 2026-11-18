import { useEffect, useState, type FormEvent } from "react";
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

export type HeroSlide = { key: string; title: string; image: string };

const SLIDE_MS = 6000;

// The signed-in home's hero. The app's promo slides crossfade behind it as
// full-bleed artwork: a deep-green fade covers each slide's own text on the
// left (where the headline and search sit) and lets the photo show on the
// right, with the slide's title and dots in the corner. In front: a personal
// headline, a search box that sends you to the right list page (venues,
// games, tournaments, squads, events) with the search text and sport
// applied, popular sports, and live "near you" counts.
export default function HomeHero({
  firstName,
  sports,
  stats,
  slides,
}: {
  firstName?: string;
  sports: { id: string; name: string }[];
  stats: HeroStat[];
  slides: HeroSlide[];
}) {
  const navigate = useAppNavigate();
  const [category, setCategory] = useState<Category>("venues");
  const [query, setQuery] = useState("");
  const [sportId, setSportId] = useState("");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = CATEGORIES.find((c) => c.key === category)!;

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, paused, slides.length]);

  const go = (url: string) => navigate(url, category === "venues" ? { state: { tab: "venues" } } : undefined);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(searchUrl(category, query, sportId));
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#062A19]" aria-label="Welcome">
      {/* Background: the highlight slides, crossfading. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {slides.map((s, i) => (
          <img
            key={s.key}
            src={s.image}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover object-[72%_center] transition-[opacity,transform] duration-[1200ms] ease-out ${
              i === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
            }`}
          />
        ))}
        {/* Phones/tablets: text spans the width, so the whole image is dimmed. */}
        <div className="absolute inset-0 bg-[#062A19]/90 lg:hidden" />
        {/* Desktop: solid behind the content column (covers the slide's own
            text), fading to the photo on the right. Stops follow the centred
            content column on wide screens. */}
        <div
          className="absolute inset-0 hidden lg:block"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #062A19 0%, #062A19 max(38%, calc(50% - 38rem + 480px)), rgba(6,42,25,0.9) max(50%, calc(50% - 38rem + 660px)), rgba(6,42,25,0.45) max(66%, calc(50% - 38rem + 920px)), rgba(6,42,25,0.12) max(84%, calc(50% - 38rem + 1180px)), rgba(6,42,25,0.05) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#062A19]/80 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#062A19]/50 to-transparent" />
      </div>

      <div className="site-container relative flex min-h-[520px] flex-col justify-center pb-20 pt-10 sm:py-14 lg:min-h-[600px] lg:py-16">
        <div className="min-w-0 max-w-[640px] animate-fadeUp">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm">
            <span aria-hidden>👋</span>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-4 text-[32px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[44px] lg:text-[52px]">
            What do you want to <span className="text-[#4ADE80]">play</span> today?
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/85 sm:text-lg">Search venues, games, squads and events near you.</p>

          <form onSubmit={submit} role="search" aria-label="Search HitLit" className="mt-7">
            <div role="tablist" aria-label="Search in" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-3">
              {CATEGORIES.map((c) => {
                const on = c.key === category;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setCategory(c.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                      on ? "bg-white text-[#062A19]" : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Ionicon name={c.icon} size={16} color={on ? "#0B7A45" : "rgba(255,255,255,0.85)"} />
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
                    className="h-11 w-full cursor-pointer bg-transparent pr-1 text-[15px] font-medium text-[#0F172A] outline-none sm:w-36"
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
              <span className="text-sm font-medium text-white/80">Popular:</span>
              {sports.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(searchUrl(category, "", s.id))}
                  className="rounded-full border border-white/25 bg-[#062A19]/40 px-3 py-1 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-white/15 pt-6">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/80">
              <span className="h-2 w-2 animate-skeleton rounded-full bg-[#4ADE80]" />
              Near you right now
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {stats.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => navigate(s.to)}
                  className="group flex items-center gap-3 rounded-2xl bg-white/[0.08] px-3 py-2.5 text-left ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/[0.14] hover:ring-white/25"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4ADE80]/15">
                    <Ionicon name={s.icon} size={17} color="#4ADE80" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold leading-tight text-white">{s.loading ? "–" : s.value}</span>
                    <span className="block truncate text-xs text-white/80">{s.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current highlight: title + dots (pauses while hovered). */}
      {slides.length > 0 && (
        <div
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full sm:left-auto sm:translate-x-0 bg-[#062A19]/70 py-2 pl-3.5 pr-3 ring-1 ring-white/15 backdrop-blur-md sm:right-6 lg:bottom-8 lg:right-[max(2rem,calc((100vw-80rem)/2+2rem))]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Ionicon name="sparkles" size={14} color="#4ADE80" />
          <span className="hidden max-w-[220px] truncate text-[13px] font-semibold text-white sm:block" aria-live="polite">
            {slides[active]?.title}
          </span>
          <span className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show highlight ${i + 1}: ${s.title}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-[#4ADE80]" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
              />
            ))}
          </span>
        </div>
      )}
    </section>
  );
}
