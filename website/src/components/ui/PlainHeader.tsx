import type { ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";
import { useGoBack } from "@/routes/navigation";

// The newer screens' compact header on the page color (no green banner):
// back arrow, extrabold title, optional muted subtitle and a right slot.
export default function PlainHeader({
  title,
  subtitle,
  backFallback = "/",
  right,
  centered,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backFallback?: string;
  right?: ReactNode;
  centered?: boolean;
}) {
  const goBack = useGoBack(backFallback);
  return (
    <header className="sticky top-0 z-20 bg-app/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className={`relative mx-auto flex min-h-[58px] w-full max-w-3xl items-center gap-2.5 px-4 py-2 ${centered ? "justify-center px-[68px]" : ""}`}>
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${centered ? "absolute left-4 border border-border bg-surface-raised" : "hover:bg-black/5"}`}
        >
          <Ionicon name="arrow-back" size={21} color={colors.ink} />
        </button>
        <div className={`min-w-0 ${centered ? "text-center" : "flex-1"}`}>
          <h1 className={`truncate font-extrabold text-ink ${centered ? "text-xl" : "text-lg"}`}>{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {right && <div className={centered ? "absolute right-4" : ""}>{right}</div>}
      </div>
    </header>
  );
}
