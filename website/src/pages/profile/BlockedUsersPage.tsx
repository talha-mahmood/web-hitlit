import { colors } from "@app/constants/theme";
import { useBlockedUsers, useUnblockUser } from "@app/hooks/useModeration";
import { useAuthStore } from "@app/store/authStore";
import type { BlockedUser } from "@app/lib/api/moderation";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";

// Port of BlockedUsersScreen: everyone you've blocked, tap the avatar for
// their profile, Unblock (with confirmation).
export default function BlockedUsersPage() {
  const navigate = useAppNavigate();
  const goBack = useGoBack(paths.accountSettings);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: blocked, isLoading } = useBlockedUsers(userId);
  const unblockUser = useUnblockUser(userId);

  const handleUnblock = (user: BlockedUser) =>
    Alert.alert(`Unblock ${user.profiles?.full_name ?? "this user"}?`, "You'll see their messages again in chat.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: () => unblockUser.mutate(user.blocked_id, { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not unblock user.")) }) },
    ]);

  return (
    <div className="mx-auto max-w-2xl lg:px-8">
      <div className="flex items-center border-b border-border bg-surface px-4 pb-4 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-0 lg:pt-6">
        <button type="button" onClick={goBack} aria-label="Back" className="mr-3 rounded-full p-1 hover:bg-gray-100">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <h1 className="text-base font-bold text-ink">Blocked Users</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (blocked ?? []).length === 0 ? (
        <p className="px-6 py-20 text-center text-sm text-muted">You haven't blocked anyone.</p>
      ) : (
        <ul className="p-4 lg:px-0">
          {(blocked ?? []).map((item) => {
            const name = item.profiles?.full_name ?? "Player";
            return (
              <li key={item.blocked_id} className="mb-2 flex items-center rounded-xl border border-border bg-surface px-4 py-3">
                <button type="button" onClick={() => navigate(paths.player(item.blocked_id))} aria-label={`View ${name}'s profile`} className="mr-3">
                  <Avatar url={item.profiles?.avatar} name={name} size={40} />
                </button>
                <span className="flex-1 truncate font-medium text-ink">{name}</span>
                <button type="button" onClick={() => handleUnblock(item)} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-50">
                  Unblock
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
