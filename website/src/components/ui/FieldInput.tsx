import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

// The app's FieldInput: rounded, soft 1.5px border, green border + tint while
// focused, optional left/right adornments inside the same box.
const FieldInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { left?: ReactNode; right?: ReactNode; containerClassName?: string }
>(function FieldInput({ left, right, containerClassName, className, ...props }, ref) {
  return (
    <label
      className={`flex cursor-text items-center rounded-2xl border-[1.5px] border-border bg-surface px-4 transition-colors focus-within:border-primary focus-within:bg-primary-light ${
        containerClassName ?? ""
      }`}
    >
      {left}
      <input
        ref={ref}
        {...props}
        className={`min-w-0 flex-1 bg-transparent py-3 text-ink outline-none placeholder:text-muted ${className ?? ""}`}
      />
      {right}
    </label>
  );
});

export default FieldInput;
