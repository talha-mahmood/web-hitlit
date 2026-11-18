import type { ReactNode } from "react";
import { BackLink } from "./PlainHeader";

// The app's dark-green brand banner as a website hero band: optional Back
// link, large title, subtitle, a right-side slot for actions, and soft
// decorative rings.
export default function PageHeader({
  title,
  subtitle,
  back,
  backFallback = "/",
  right,
  icon,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  backFallback?: string;
  right?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative mx-3 mt-4 overflow-hidden rounded-3xl bg-brand px-5 pb-6 pt-5 shadow-hero sm:mx-6 sm:mt-6 sm:px-8 sm:pb-8 sm:pt-6 lg:mx-0">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-white/[0.06]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-white/[0.04]" />
      <div className="relative">
        {back && (
          <div className="mb-3">
            <BackLink fallback={backFallback} light />
          </div>
        )}
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 truncate text-sm text-white/85 sm:text-base">{subtitle}</p> : null}
          </div>
          {right}
        </div>
        {children}
      </div>
    </header>
  );
}
