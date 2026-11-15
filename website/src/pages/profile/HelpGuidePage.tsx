import { useMemo, useState } from "react";
import { colors } from "@app/constants/theme";
import { USER_GUIDE, type GuideChapter } from "@app/content/userGuide";
import { Ionicon } from "@/components/icons/Icon";
import { useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// A chapter survives a search if its title/intro or any section matches.
function searchableChapter(chapter: GuideChapter, query: string): GuideChapter | null {
  if (!query) return chapter;
  const q = query.trim().toLocaleLowerCase();
  const chapterMatches = `${chapter.title} ${chapter.intro}`.toLocaleLowerCase().includes(q);
  const sections = chapterMatches
    ? chapter.sections
    : chapter.sections.filter((s) => `${s.title} ${s.body} ${(s.steps ?? []).join(" ")} ${s.tip ?? ""}`.toLocaleLowerCase().includes(q));
  return sections.length ? { ...chapter, sections } : null;
}

// Port of HelpGuideScreen: the offline user guide (same chapters as the
// app), searchable, with a chapter strip that jumps to and opens a chapter.
export default function HelpGuidePage() {
  const goBack = useGoBack(paths.accountSettings);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(USER_GUIDE[0]?.id ?? null);
  const chapters = useMemo(() => USER_GUIDE.map((c) => searchableChapter(c, query)).filter((c): c is GuideChapter => c !== null), [query]);
  const searching = query.trim().length > 0;

  const openChapter = (chapter: GuideChapter) => {
    setExpandedId(chapter.id);
    requestAnimationFrame(() => document.getElementById(`guide-${chapter.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 lg:px-8">
      <header className="flex items-center gap-3 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] lg:pt-6">
        <button type="button" onClick={goBack} aria-label="Go back" className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface-raised hover:brightness-95">
          <Ionicon name="arrow-back" size={21} color={colors.ink} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-ink">Help &amp; User Guide</h1>
          <p className="mt-0.5 text-xs text-muted">Learn your way around HitLit</p>
        </div>
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-primary-light">
          <Ionicon name="book-outline" size={20} color={colors.primary} />
        </span>
      </header>

      <section className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light">
            <Ionicon name="football-outline" size={24} color={colors.primary} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-ink">Your HitLit playbook</h2>
            <p className="mt-1 text-sm leading-5 text-muted">A practical guide to finding games, organizing teams, following scores, booking venues, and using your account.</p>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-info-light px-3 py-2.5 text-xs text-muted">
          <Ionicon name="information-circle-outline" size={17} color={colors.primary} />
          This guide reflects features currently available in the app. Search it or choose a chapter below.
        </p>
      </section>

      <label className="mb-3 flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-3 focus-within:border-primary">
        <Ionicon name="search-outline" size={19} color={colors.muted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guide..." aria-label="Search the user guide" type="search" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-muted" />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <Ionicon name="close-circle" size={19} color={colors.muted} />
          </button>
        )}
      </label>

      {!searching && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-bold text-ink">Browse chapters</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto py-0.5 sm:flex-wrap">
            {USER_GUIDE.map((c, i) => (
              <button key={c.id} type="button" onClick={() => openChapter(c)} aria-label={`Open chapter ${i + 1}: ${c.title}`} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 hover:border-primary/40">
                <span className="text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs font-semibold text-ink">{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">{searching ? "Search results" : "Guide chapters"}</p>
        <p className="text-xs text-muted">
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
        </p>
      </div>

      {chapters.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-surface px-5 py-8 text-center shadow-card">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
            <Ionicon name="search-outline" size={22} color={colors.muted} />
          </span>
          <p className="font-bold text-ink">No guide results</p>
          <p className="mt-1 text-sm text-muted">Try another feature name or clear your search.</p>
        </div>
      ) : (
        chapters.map((chapter) => {
          const expanded = searching || expandedId === chapter.id;
          const index = USER_GUIDE.findIndex((c) => c.id === chapter.id);
          return (
            <article key={chapter.id} id={`guide-${chapter.id}`} className="mb-3 scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              <button type="button" onClick={() => setExpandedId(expanded ? null : chapter.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary-light">
                  <Ionicon name={chapter.icon} size={20} color={colors.primary} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold tracking-wider text-primary">CHAPTER {String(index + 1).padStart(2, "0")}</span>
                  <span className="mt-0.5 block text-base font-bold text-ink">{chapter.title}</span>
                  {!expanded && <span className="mt-1 line-clamp-2 block text-xs text-muted">{chapter.intro}</span>}
                </span>
                <Ionicon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
              </button>
              {expanded && (
                <div className="px-4 pb-4">
                  <p className="mb-3 text-sm leading-5 text-muted">{chapter.intro}</p>
                  {chapter.sections.map((section, si) => (
                    <div key={section.title} className="mb-2.5 rounded-xl border border-border bg-surface-raised p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-extrabold text-primary">{si + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink">{section.title}</p>
                          <p className="mt-1 text-sm leading-5 text-muted">{section.body}</p>
                          {section.steps?.map((step, i) => (
                            <p key={i} className="mt-2 flex gap-2 text-xs leading-5 text-ink-secondary">
                              <span className="font-bold text-primary">{i + 1}.</span>
                              <span className="flex-1">{step}</span>
                            </p>
                          ))}
                          {section.tip && (
                            <p className="mt-3 flex gap-[7px] rounded-lg bg-primary-light px-2.5 py-2 text-xs leading-4 text-ink-secondary">
                              <Ionicon name="bulb-outline" size={15} color={colors.primary} />
                              <span className="flex-1">{section.tip}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })
      )}

      <p className="mt-2 px-3 text-center text-[11px] leading-4 text-muted">Screens and options can vary by sport, membership, account permissions, and available data.</p>
    </div>
  );
}
