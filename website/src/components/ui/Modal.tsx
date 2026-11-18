import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";

// The app's bottom-sheet modals (Select Sport, Select Location, …): drag
// handle, 22px extrabold title + muted subtitle, round gray X, scrollable
// body, pinned footer. A bottom sheet on phones, a centered dialog on larger
// screens. Esc / backdrop close.
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="relative flex max-h-[85dvh] w-full animate-fadeUp flex-col rounded-t-3xl bg-surface pb-[calc(20px+env(safe-area-inset-bottom))] shadow-hero sm:rounded-3xl sm:pb-5"
        style={{ maxWidth }}
      >
        <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-sm bg-border" />
        </div>
        {title ? (
          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-3 sm:pt-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-extrabold text-ink">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[13.5px] text-muted">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
            >
              <Ionicon name="close" size={18} color={colors.ink} />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">{children}</div>
        {footer ? <div className="px-5 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

// The sheets' standard footer: outlined Clear + gradient Apply Filter.
export function ClearApplyFooter({ onClear, onApply, applyLabel = "Apply Filter" }: { onClear: () => void; onApply: () => void; applyLabel?: string }) {
  return (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onClear}
        className="press h-[52px] flex-1 rounded-2xl border-[1.5px] border-border bg-surface text-base font-bold text-ink hover:bg-gray-50"
      >
        Clear
      </button>
      <button type="button" onClick={onApply} className="press h-[52px] flex-1 rounded-2xl bg-brand text-base font-bold text-white shadow-cta hover:brightness-110">
        {applyLabel}
      </button>
    </div>
  );
}
