import { useEffect, useRef, useState } from "react";
import { colors } from "@app/constants/theme";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import Spinner from "@/components/ui/Spinner";
import TermsContent from "@/components/onboarding/TermsContent";

// Port of AcceptTermsScreen: shown once after sign-in to anyone whose profile
// has no terms_accepted_at. The agree checkbox unlocks only after the terms
// are scrolled to the end; going back signs out.
export default function AcceptTermsPage() {
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [canAgree, setCanAgree] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Content short enough to need no scrolling unlocks straight away.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      if (el.scrollHeight <= el.clientHeight + 4) setCanAgree(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleBack = async () => {
    setIsGoingBack(true);
    try {
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert("Couldn't go back", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
      setIsGoingBack(false);
    }
  };

  const handleAgree = async () => {
    const userId = session?.user.id;
    if (!userId || !agreed) return;
    setIsSaving(true);
    try {
      await updateProfile(userId, { terms_accepted_at: new Date().toISOString() });
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand px-6 py-6">
      <main className="flex h-[min(calc(100dvh-48px),760px)] w-full max-w-lg flex-col rounded-3xl bg-surface px-6 py-6 shadow-hero">
        <button type="button" onClick={handleBack} disabled={isGoingBack} aria-label="Back" className="-ml-2 -mt-2 mb-1 flex h-9 w-9 items-center justify-center self-start rounded-full hover:bg-black/5">
          {isGoingBack ? <Spinner size={18} color={colors.ink} /> : <Ionicon name="arrow-back" size={20} color={colors.ink} />}
        </button>
        <h1 className="text-center text-xl font-extrabold text-ink">Terms of Service</h1>
        <p className="mt-1.5 px-2 text-center text-sm text-muted">Please read and accept our terms to continue.</p>
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label="Terms of Service text"
          className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2 pr-1"
          onScroll={(e) => {
            if (canAgree) return;
            const el = e.currentTarget;
            if (el.clientHeight + el.scrollTop >= el.scrollHeight - 24) setCanAgree(true);
          }}
        >
          <TermsContent />
        </div>
        {canAgree ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={agreed}
            onClick={() => setAgreed((v) => !v)}
            className={`mt-4 flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-3.5 text-left ${agreed ? "border-primary bg-primary-light" : "border-border bg-surface-raised"}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] ${agreed ? "border-primary bg-primary" : "border-border bg-surface"}`}>
              {agreed && <Ionicon name="checkmark" size={15} color="white" />}
            </span>
            <span className="flex-1 text-[13.5px] leading-[19px] text-ink">
              I've read and agree to the <b>Terms of Service</b> and <b>Privacy Policy</b> above, including the zero-tolerance policy for objectionable content and abusive users.
            </span>
          </button>
        ) : (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Ionicon name="arrow-down-circle-outline" size={15} color={colors.muted} />
            Scroll to the end to continue
          </p>
        )}
        <button
          type="button"
          onClick={handleAgree}
          disabled={isSaving || !agreed}
          className="press mt-4 flex w-full items-center justify-center rounded-2xl bg-brand py-3.5 text-base font-semibold text-white"
          style={{ opacity: agreed ? 1 : 0.4 }}
        >
          {isSaving ? <Spinner size={20} color="white" /> : "Agree & Continue"}
        </button>
      </main>
    </div>
  );
}
