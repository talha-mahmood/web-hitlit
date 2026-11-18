import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

// The app's GradientFill CTA: brand-green gradient, rounded-2xl, white
// semibold label, tinted shadow; dims while disabled.
export function GradientButton({ loading, icon, children, className, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "press inline-flex items-center justify-center gap-3 rounded-xl bg-brand px-5 py-3.5 text-base font-semibold text-white shadow-cta transition hover:brightness-110 hover:shadow-[0_8px_18px_rgb(var(--jz-primary)/0.3)]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        loading && "!opacity-70",
        className
      )}
    >
      {loading ? <Spinner color="white" /> : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

// The app's OutlineActionButton: white, 1.5px border, ink label.
export function OutlineButton({ loading, icon, children, className, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "press inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-border bg-surface px-5 py-3 text-base font-semibold text-ink-secondary transition-colors hover:border-primary/40",
        "hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {loading ? <Spinner /> : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
