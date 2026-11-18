// Backs the app's custom-styled Alert dialog (see CustomAlertHost +
// alertPolyfill). A tiny pub/sub instead of Zustand/Context since there's
// only ever one subscriber — the single <CustomAlertHost /> mounted at the
// app root.
export type AppAlertButtonStyle = "default" | "cancel" | "destructive";

export type AppAlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AppAlertButtonStyle;
};

export type AppAlertState = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
} | null;

type Listener = (state: AppAlertState) => void;
let listener: Listener | null = null;

export function subscribeAlert(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function showCustomAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const finalButtons: AppAlertButton[] = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  listener?.({ title, message, buttons: finalButtons });
}

export function hideCustomAlert() {
  listener?.(null);
}
