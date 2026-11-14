import { useEffect, useState, type ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { supabase } from "@app/lib/supabase";
import { signOutGoogle } from "@app/lib/googleAuth";
import { signOutWithPushCleanup } from "@app/lib/pushNotifications";
import { useProfileStore } from "@app/store/profileStore";
import { useAuthStore } from "@app/store/authStore";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import FieldInput from "@/components/ui/FieldInput";
import Spinner from "@/components/ui/Spinner";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

function SectionCard({ icon, iconBg = colors.primaryLight, iconFg = colors.primaryDark, title, subtitle, children }: { icon: string; iconBg?: string; iconFg?: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
          <Ionicon name={icon} size={20} color={iconFg} />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SaveButton({ enabled, saving, label, onPress }: { enabled: boolean; saving: boolean; label: string; onPress: () => void }) {
  return (
    <button
      type="submit"
      onClick={onPress}
      disabled={!enabled || saving}
      className={`mt-3 flex w-full items-center justify-center rounded-2xl py-3.5 font-bold ${enabled ? "press bg-brand text-white" : "cursor-not-allowed bg-gray-200 text-muted"}`}
    >
      {saving ? <Spinner size={18} color="white" /> : label}
    </button>
  );
}

const signOut = async () => {
  await signOutGoogle();
  signOutWithPushCleanup();
};

// Port of AccountSettingsScreen: email, Blocked Users, display name, jersey
// number, profile visibility, the type-DELETE account deletion, Sign out.
export default function AccountSettingsPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.profile);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const userId = useAuthStore((s) => s.session?.user.id);

  const [name, setName] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [jerseyNumber, setJerseyNumber] = useState(profile?.jersey_number != null ? String(profile.jersey_number) : "");
  const [savingJersey, setSavingJersey] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const visibility = profile?.visibility ?? "public";

  const nameChanged = name.trim() !== (profile?.full_name ?? "").trim();
  const nameValid = isValidName(name);
  const jerseyChanged = jerseyNumber !== (profile?.jersey_number != null ? String(profile.jersey_number) : "");
  const jerseyValid = jerseyNumber === "" || /^\d{1,3}$/.test(jerseyNumber);

  const save = async (changes: Parameters<typeof updateProfile>[1], setBusy: (b: boolean) => void, done?: string) => {
    if (!userId) return;
    setBusy(true);
    try {
      await updateProfile(userId, changes);
      if (done) Alert.alert("Saved", done);
    } catch (err) {
      Alert.alert("Could not save", getFriendlyErrorMessage(err, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const closeDelete = () => {
    setDeleteModalOpen(false);
    setDeleteConfirmText("");
  };

  useEffect(() => {
    if (!deleteModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isDeleting && closeDelete();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteModalOpen, isDeleting]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
      await signOutGoogle();
      await signOutWithPushCleanup();
    } catch (err) {
      Alert.alert("Couldn't delete account", getFriendlyErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setIsDeleting(false);
      closeDelete();
    }
  };

  return (
    <div className="mx-auto max-w-2xl pb-10 lg:px-8">
      <div className="flex items-center px-3.5 pb-[22px] pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-6">
        <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={24} color={colors.ink} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-ink">Account Settings</h1>
          <p className="mt-0.5 text-sm text-muted">Manage your account details</p>
        </div>
      </div>

      <div className="px-5 lg:px-0">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="mail-outline" size={20} color={colors.primaryDark} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Email</p>
            <p className="mt-0.5 truncate text-sm font-bold text-ink">{profile?.email ?? "—"}</p>
          </div>
        </div>

        <button type="button" onClick={() => navigate(paths.blockedUsers)} className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-card transition hover:shadow-hero">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <Ionicon name="hand-left-outline" size={20} color={colors.primaryDark} />
          </span>
          <span className="flex-1">
            <span className="block text-base font-bold text-ink">Blocked Users</span>
            <span className="mt-0.5 block text-sm text-muted">Manage who you've blocked</span>
          </span>
          <Ionicon name="chevron-forward" size={18} color={colors.muted} />
        </button>

        <SectionCard icon="person-outline" title="Display Name" subtitle="This name will be visible to other players.">
          <form onSubmit={(e) => e.preventDefault()}>
            <FieldInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} aria-label="Display name" />
            {!nameValid && name.length > 0 && <p className="mt-2 text-xs text-red-500">Name must be {NAME_REQUIREMENT_HINT}.</p>}
            <SaveButton enabled={nameChanged && nameValid} saving={savingName} label="Save Name" onPress={() => nameValid && save({ full_name: name.trim() }, setSavingName, "Your display name has been updated.")} />
          </form>
        </SectionCard>

        <SectionCard icon="shirt-outline" title="Jersey Number" subtitle="Shown on your profile and player card.">
          <form onSubmit={(e) => e.preventDefault()}>
            <FieldInput
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              placeholder="e.g. 11"
              inputMode="numeric"
              maxLength={3}
              aria-label="Jersey number"
            />
            {!jerseyValid && <p className="mt-2 text-xs text-red-500">Jersey number must be up to 3 digits.</p>}
            <SaveButton
              enabled={jerseyChanged && jerseyValid}
              saving={savingJersey}
              label="Save Jersey Number"
              onPress={() => jerseyValid && save({ jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber) }, setSavingJersey, "Your jersey number has been updated.")}
            />
          </form>
        </SectionCard>

        <SectionCard icon="eye-outline" title="Profile Visibility" subtitle="Public players can be found and invited to teams/squads. Private players are hidden from Invite Players search.">
          <div role="radiogroup" aria-label="Profile visibility" className="flex gap-1 rounded-2xl bg-gray-100 p-1">
            {(["public", "private"] as const).map((option) => {
              const selected = visibility === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => userId && option !== visibility && save({ visibility: option }, setSavingVisibility)}
                  disabled={savingVisibility}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold ${selected ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                >
                  {selected && savingVisibility ? (
                    <Spinner size={16} color="white" />
                  ) : (
                    <>
                      <Ionicon name={option === "public" ? "eye-outline" : "eye-off-outline"} size={15} color={selected ? "white" : colors.muted} />
                      {option === "public" ? "Public" : "Private"}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard icon="warning-outline" iconBg="rgb(var(--jz-red-50))" iconFg={colors.danger} title="Danger Zone" subtitle="Permanently delete your account and everything tied to it. This can't be undone.">
          <button type="button" onClick={() => setDeleteModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 font-semibold text-danger hover:bg-red-100">
            <Ionicon name="trash-outline" size={16} color={colors.danger} />
            Delete Account
          </button>
        </SectionCard>

        <button type="button" onClick={signOut} className="press mt-4 w-full rounded-xl bg-brand py-4 text-[17px] font-semibold text-white">
          Sign out
        </button>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => !isDeleting && closeDelete()} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="relative flex w-full max-w-sm animate-pop flex-col items-center rounded-2xl bg-surface p-5">
            <span className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red-50">
              <Ionicon name="warning-outline" size={26} color={colors.danger} />
            </span>
            <h2 id="delete-title" className="mb-1 text-lg font-bold text-ink">
              Delete Account
            </h2>
            <p className="mb-4 text-center text-sm text-muted">This permanently deletes your account and everything tied to it — games you've hosted, squads you've created, bookings, and messages. This can't be undone.</p>
            <p className="mb-2 self-start text-sm text-muted">Type DELETE to confirm.</p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
              autoFocus
              className="mb-4 w-full rounded-xl border border-border px-4 py-3 text-ink outline-none focus:border-danger"
            />
            <button
              type="button"
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              onClick={handleDeleteAccount}
              className="flex w-full items-center justify-center rounded-xl bg-danger py-3 font-semibold text-white"
              style={{ opacity: deleteConfirmText === "DELETE" && !isDeleting ? 1 : 0.4 }}
            >
              {isDeleting ? <Spinner size={18} color="white" /> : "Delete My Account"}
            </button>
            <button type="button" disabled={isDeleting} onClick={closeDelete} className="mt-1 w-full py-3 font-medium text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
