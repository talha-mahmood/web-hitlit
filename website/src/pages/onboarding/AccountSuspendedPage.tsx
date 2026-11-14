import { useState } from "react";
import { colors } from "@app/constants/theme";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";

// Port of AccountSuspendedScreen: an ejected account (profile.isactive =
// false) only gets this — sign out is the only way forward.
export default function AccountSuspendedPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      setIsSigningOut(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand px-6">
      <main className="flex w-full max-w-md flex-col items-center rounded-3xl bg-surface px-6 py-8 shadow-hero">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-light">
          <Ionicon name="ban-outline" size={30} color={colors.danger} />
        </span>
        <h1 className="text-center text-xl font-extrabold text-ink">Account Suspended</h1>
        <p className="mt-2 px-2 text-center text-sm text-muted">
          Your account has been suspended for violating our community guidelines. If you believe this is a mistake, contact support.
        </p>
        <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="press mt-6 flex w-full items-center justify-center rounded-2xl bg-danger py-3.5 text-base font-semibold text-white">
          {isSigningOut ? <Spinner size={20} color="white" /> : "Sign Out"}
        </button>
      </main>
    </div>
  );
}
