// Side-effect module: patches React Native's built-in `Alert.alert` so that
// every existing `Alert.alert(title, message, buttons)` call site in the
// app (there are 260+, across ~70 files) renders our custom-styled dialog
// (CustomAlertHost) instead of the native OS alert — without needing to
// touch any of those call sites individually.
//
// This works because every file's `import { Alert } from "react-native"` is
// a reference to the SAME exported object — reassigning the `.alert`
// property here mutates that shared object, so every other import sees the
// override too. Must be imported once, as early as possible (top of App.tsx,
// before any screen can call Alert.alert on mount).
import { Alert } from "react-native";
import { showCustomAlert, type AppAlertButton } from "./alertStore";

const patchedAlert: typeof Alert.alert = (title, message, buttons) => {
  showCustomAlert(title, message ?? undefined, buttons as AppAlertButton[] | undefined);
};

Alert.alert = patchedAlert;
