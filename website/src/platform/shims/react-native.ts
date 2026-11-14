// Minimal web stand-in for the few `react-native` exports the shared app
// logic touches. Anything UI-related is rendered by the website's own
// components — this only exists so shared, platform-agnostic files keep
// compiling and behaving the same on the web.
import { showCustomAlert, type AppAlertButton } from "@app/lib/alertStore";

export type ImageSourcePropType = string | number | { uri: string };
export type TextProps = Record<string, unknown>;
export type TextInputProps = Record<string, unknown>;

export const Platform = {
  OS: "web" as "web" | "ios" | "android",
  select<T>(spec: { web?: T; default?: T; ios?: T; android?: T }): T | undefined {
    return spec.web ?? spec.default;
  },
};

// Same signature as RN's Alert.alert — routed to the app's own custom
// dialog (AlertHost), exactly like the mobile app's alertPolyfill does.
export const Alert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[]) {
    showCustomAlert(title, message, buttons);
  },
};

type AppStateStatus = "active" | "background";
export const AppState = {
  get currentState(): AppStateStatus {
    return typeof document !== "undefined" && document.visibilityState === "hidden" ? "background" : "active";
  },
  addEventListener(_type: "change", handler: (state: AppStateStatus) => void) {
    const listener = () => handler(AppState.currentState);
    document.addEventListener("visibilitychange", listener);
    return { remove: () => document.removeEventListener("visibilitychange", listener) };
  },
};

export const Share = {
  async share(content: { message?: string; url?: string; title?: string }) {
    const url = content.url ?? content.message ?? "";
    if (navigator.share) {
      await navigator.share({ title: content.title, text: content.message, url: content.url });
      return { action: "sharedAction" };
    }
    await navigator.clipboard.writeText(url);
    showCustomAlert("Link copied", "The link has been copied to your clipboard.");
    return { action: "sharedAction" };
  },
};

export const StyleSheet = {
  flatten<T>(style: T): T {
    return Array.isArray(style) ? (Object.assign({}, ...style.flat(Infinity).filter(Boolean)) as T) : style;
  },
  create<T>(styles: T): T {
    return styles;
  },
};

type ColorScheme = "light" | "dark";
export const Appearance = {
  getColorScheme(): ColorScheme {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  },
  addChangeListener(handler: (prefs: { colorScheme: ColorScheme }) => void) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => handler({ colorScheme: mq.matches ? "light" : "dark" });
    mq.addEventListener("change", listener);
    return { remove: () => mq.removeEventListener("change", listener) };
  },
};
