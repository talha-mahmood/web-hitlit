import { showCustomAlert, type AppAlertButton } from "@app/lib/alertStore";

// Same call shape as React Native's Alert.alert, rendered by <AlertHost />
// through the app's own alertStore — so ported screen code reads the same.
export const Alert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[]) {
    showCustomAlert(title, message, buttons);
  },
};
