import type { ReactNode } from "react";
import { Ionicon } from "../icons/Icon";
import { useGoBack } from "@/routes/navigation";

// The app's "#14532D"-family dark-green rounded-bottom banner used across
// tab-root and detail screens: optional back arrow, title, subtitle, and a
// right-side slot for actions.
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
  const goBack = useGoBack(backFallback);
  return (
    <header className="rounded-b-[32px] bg-brand px-3.5 pb-5 pt-[calc(env(safe-area-inset-top)+14px)] sm:px-6 lg:rounded-[32px] lg:px-7 lg:py-6">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          >
            <Ionicon name="arrow-back" size={22} color="white" />
          </button>
        )}
        {icon}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold text-white">{title}</h1>
          {subtitle ? <p className="mt-0.5 truncate text-sm text-white/85">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}
