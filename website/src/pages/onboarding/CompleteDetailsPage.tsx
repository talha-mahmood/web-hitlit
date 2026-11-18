import { useState } from "react";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { useAuthStore } from "@app/store/authStore";
import { useProfileStore } from "@app/store/profileStore";
import type { Database } from "@app/types/database.types";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { GradientButton } from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

type Gender = Database["public"]["Enums"]["gender_type"];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

// Port of CompleteDetailsScreen — shown once after a brand-new sign-in until
// a gender is saved (isProfileComplete). Back = abandon this sign-in.
export default function CompleteDetailsPage() {
  const session = useAuthStore((s) => s.session);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [isSaving, setIsSaving] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);

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

  const handleContinue = async () => {
    const userId = session?.user.id;
    if (!userId || !gender) return;
    setIsSaving(true);
    try {
      await updateProfile(userId, { gender });
      // RootGate re-evaluates isProfileComplete() once the store updates.
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand px-6 py-10">
      <div className="flex w-full max-w-[420px] animate-pop flex-col items-center rounded-3xl bg-surface px-6 py-8 shadow-hero">
        <button
          type="button"
          onClick={handleBack}
          disabled={isGoingBack}
          aria-label="Back to sign in"
          className="-ml-2 -mt-2 mb-1 flex h-9 w-9 items-center justify-center self-start rounded-full hover:bg-gray-100"
        >
          {isGoingBack ? <Spinner size={18} color="#1A1A1A" /> : <Ionicon name="arrow-back" size={20} />}
        </button>

        <h1 className="text-center text-xl font-extrabold text-ink">Just one more step</h1>
        <p className="mt-1.5 px-2 text-center text-sm text-muted">
          We use your gender to match you into gender-specific games and squads, like Male Only or Female Only groups.
        </p>

        <fieldset className="mt-6 w-full">
          <legend className="mb-2 flex items-center text-sm text-muted">
            Gender<span className="ml-1 text-red-500">*</span>
          </legend>
          <div className="flex gap-2.5" role="radiogroup">
            {GENDER_OPTIONS.map((opt) => {
              const selected = gender === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGender(opt.value)}
                  className={`press flex-1 rounded-xl border-[1.5px] py-3 text-sm ${
                    selected
                      ? "border-primary bg-brand font-bold text-white"
                      : "border-border bg-surface font-medium text-ink hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <GradientButton onClick={handleContinue} disabled={!gender} loading={isSaving} className="mt-6 w-full">
          Continue
        </GradientButton>
        {!gender && <p className="mt-3 text-center text-xs text-muted">Select your gender to continue.</p>}
      </div>
    </div>
  );
}
