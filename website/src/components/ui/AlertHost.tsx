import { useEffect, useRef, useState } from "react";
import { subscribeAlert, type AppAlertState } from "@app/lib/alertStore";
import { Ionicon } from "../icons/Icon";
import { colors } from "@app/constants/theme";

// Web port of the app's CustomAlertHost: every Alert.alert(...) renders as
// this one dialog — white rounded card, tinted icon circle, bold title,
// muted message, Cancel/action buttons. Esc / backdrop click dismiss it.
export default function AlertHost() {
  const [state, setState] = useState<AppAlertState>(null);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeAlert(setState), []);

  useEffect(() => {
    if (!state) return;
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;

  const isDestructive = state.buttons.some((b) => b.style === "destructive");
  const hasCancel = state.buttons.some((b) => b.style === "cancel");
  const iconBg = isDestructive ? "rgb(var(--jz-red-50))" : colors.primaryLight;
  const iconColor = isDestructive ? colors.danger : colors.primaryDark;
  const iconName = isDestructive ? "warning-outline" : hasCancel ? "help-circle-outline" : "information-circle-outline";
  const stacked = state.buttons.length > 2;

  const close = (onPress?: () => void) => {
    setState(null);
    if (onPress) setTimeout(onPress, 0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-7" role="presentation">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.5)]" onClick={() => close()} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-alert-title"
        className="relative flex w-full max-w-[360px] animate-pop flex-col items-center rounded-[26px] bg-surface p-6 shadow-card"
      >
        <div
          className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg }}
        >
          <Ionicon name={iconName} size={34} color={iconColor} />
        </div>
        <h2 id="app-alert-title" className="text-center text-xl font-extrabold text-ink">
          {state.title}
        </h2>
        {!!state.message && (
          <p className="mt-2 whitespace-pre-line text-center text-[15px] leading-5 text-muted">{state.message}</p>
        )}
        <div className={`mt-[22px] flex w-full gap-2.5 ${stacked ? "flex-col" : "flex-row"}`}>
          {state.buttons.map((b, i) => {
            const isCancel = b.style === "cancel";
            const isDanger = b.style === "destructive";
            return (
              <button
                key={i}
                ref={i === 0 ? firstButton : undefined}
                type="button"
                onClick={() => close(b.onPress ? () => b.onPress!() : undefined)}
                className={`press flex-1 rounded-[18px] py-3.5 text-base font-bold ${
                  isCancel
                    ? "border-[1.5px] border-border bg-surface text-ink-secondary hover:bg-gray-50"
                    : isDanger
                      ? "bg-danger text-white hover:brightness-95"
                      : "bg-primary text-white hover:brightness-95"
                }`}
              >
                {b.text ?? "OK"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
