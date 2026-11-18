import type { ReactNode } from "react";
import { Link } from "react-router";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";
import { useGoBack } from "@/routes/navigation";

export type Crumb = { label: string; to: string };

// Breadcrumb trail ending at the current page.
export function Breadcrumbs({ crumbs, current, light }: { crumbs: Crumb[]; current: ReactNode; light?: boolean }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={`flex flex-wrap items-center gap-1 text-[13px] font-medium ${light ? "text-white/85" : "text-ink-secondary"}`}>
        {crumbs.map((c) => (
          <li key={c.to} className="flex items-center gap-1">
            <Link to={c.to} className={`rounded transition-colors ${light ? "hover:text-white" : "hover:text-primary"}`}>
              {c.label}
            </Link>
            <Ionicon name="chevron-forward" size={13} color={light ? "rgba(255,255,255,0.6)" : colors.muted} />
          </li>
        ))}
        <li aria-current="page" className={`truncate font-semibold ${light ? "text-white" : "text-ink-secondary"}`}>
          {current}
        </li>
      </ol>
    </nav>
  );
}

// "← Back" link that never leaves the site (history back, else a fallback).
export function BackLink({ fallback = "/", light }: { fallback?: string; light?: boolean }) {
  const goBack = useGoBack(fallback);
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className={`-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold transition-colors ${
        light ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-secondary hover:bg-black/5 hover:text-ink"
      }`}
    >
      <Ionicon name="arrow-back" size={16} color={light ? "white" : colors.inkSecondary} />
      Back
    </button>
  );
}

// Page title section: breadcrumb (top-level pages) or Back link
// (drill-downs), a large title, optional subtitle and an actions slot.
// `wide` lines up with full-width list pages; otherwise it matches the
// narrower reading column most detail pages use.
export default function PlainHeader({
  title,
  subtitle,
  backFallback = "/",
  right,
  crumbs,
  wide,
  flush,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backFallback?: string;
  right?: ReactNode;
  /** @deprecated kept for call sites; the website header is always left-aligned. */
  centered?: boolean;
  crumbs?: Crumb[];
  wide?: boolean;
  /** The page wrapper already has side padding. */
  flush?: boolean;
}) {
  return (
    <header className={`mx-auto w-full pb-3 pt-5 sm:pt-8 ${flush ? "px-0" : wide ? "px-4 sm:px-6 lg:px-0" : "max-w-3xl px-4"}`}>
      <div className="mb-2 min-h-[26px]">{crumbs ? <Breadcrumbs crumbs={crumbs} current={title} /> : <BackLink fallback={backFallback} />}</div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl lg:text-[34px] lg:leading-[1.15]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-secondary sm:text-base">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
