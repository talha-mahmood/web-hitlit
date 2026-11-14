import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { colors } from "@app/constants/theme";
import {
  useAllVenues,
  useDeleteVenue,
  useCreateVenue,
  useAllGames,
  useDeleteGameAsSuperadmin,
  useAllSquads,
  useDisbandSquadAsSuperadmin,
  useAllEvents,
  useDisbandEventAsSuperadmin,
  useContentReports,
  useRemoveReportedContent,
  useEjectUser,
  useDismissReport,
  useAllUsers,
  useSetUserActive,
} from "@app/hooks/useSuperadmin";
import { useUnreadNotificationCount } from "@app/hooks/useNotifications";
import { useAuthStore } from "@app/store/authStore";
import { isValidName, NAME_REQUIREMENT_HINT } from "@app/lib/nameValidation";
import { formatCommunityTimeAgo } from "@app/lib/communityTime";
import { getFriendlyErrorMessage } from "@app/lib/friendlyError";
import type { ContentReport } from "@app/lib/api/moderation";
import type { AllUsersListItem } from "@app/lib/api/superadmin";
import { Alert } from "@/lib/alert";
import { Ionicon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import FieldInput from "@/components/ui/FieldInput";
import NotificationBell from "@/components/NotificationBell";
import { SkeletonCardRows } from "@/components/ui/Skeleton";
import { SuperAdminSectionSwitcher, type SuperSection } from "@/components/admin/AdminMenus";
import { AdminPageHeader, CyclingSearchField, EmptyBox, FieldLabel, GradientAction, PageBody, TextArea, useAdminPaths } from "@/components/admin/AdminParts";
import { useAppNavigate } from "@/routes/navigation";

const confirmDestructive = (title: string, message: string, label: string, onConfirm: () => void) =>
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: label, style: "destructive", onPress: onConfirm },
  ]);
const onErr = (fallback: string) => (err: unknown) => Alert.alert("Error", getFriendlyErrorMessage(err, fallback));

// Every superadmin section page: section switcher + title + bell (+ extra
// actions), a cycling search field, then the list.
function SectionShell({
  active,
  title,
  actions,
  search,
  setSearch,
  variants,
  isLoading,
  emptyIcon,
  emptyText,
  children,
}: {
  active: SuperSection;
  title: string;
  actions?: ReactNode;
  search: string;
  setSearch: (v: string) => void;
  variants: string[];
  isLoading: boolean;
  emptyIcon: string;
  emptyText: string;
  children: ReactNode[] | null;
}) {
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: unreadCount } = useUnreadNotificationCount(userId);
  return (
    <div className="mx-auto w-full max-w-5xl px-3.5 pb-16 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-8 lg:pt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SuperAdminSectionSwitcher active={active} />
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
        </div>
        <div className="flex items-center gap-3.5">
          <NotificationBell unreadCount={unreadCount} onPress={() => navigate(p.notifications)} />
          {actions}
        </div>
      </div>
      <div className="mb-3">
        <CyclingSearchField value={search} onChange={setSearch} prefix="Search by " variants={variants} />
      </div>
      {isLoading ? <SkeletonCardRows /> : !children || children.length === 0 ? <EmptyBox icon={emptyIcon} text={emptyText} /> : <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

function IconButton({ icon, color, label, onPress }: { icon: string; color: string; label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      className="shrink-0 rounded-full p-1.5 hover:bg-black/5"
    >
      <Ionicon name={icon} size={20} color={color} />
    </button>
  );
}

// Port of AllVenuesListScreen.
export function AllVenuesListPage() {
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const [search, setSearch] = useState("");
  const { data: venues, isLoading } = useAllVenues(search || undefined);
  const deleteVenue = useDeleteVenue();
  return (
    <SectionShell
      active="venues"
      title="All Venues"
      actions={<GradientAction small icon="add" label="New Venue" onPress={() => navigate(p.createVenue)} />}
      search={search}
      setSearch={setSearch}
      variants={["venue name"]}
      isLoading={isLoading}
      emptyIcon="business-outline"
      emptyText="No venues found."
    >
      {(venues ?? []).map((v) => (
        <Link key={v.id} to={p.venue(v.id)} className="flex items-center rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40">
          <div className="mr-3 min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">{v.name}</span>
              {!v.isactive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-muted">Closed</span>}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">{v.city ?? "City not set"}</p>
            <p className="mt-1 truncate text-xs" style={{ color: v.profiles ? colors.primaryDark : colors.warning }}>
              {v.profiles ? `Admin: ${v.profiles.full_name ?? v.profiles.email}` : "No admin assigned"}
            </p>
          </div>
          <IconButton icon="person-add-outline" color={colors.primary} label="Manage admins" onPress={() => navigate(p.admins(v.id), { state: { currentAdminEmail: v.profiles?.email ?? null } })} />
          <IconButton
            icon="trash-outline"
            color={colors.danger}
            label="Delete venue"
            onPress={() =>
              confirmDestructive("Delete Venue", `Delete "${v.name}"? It'll be hidden from customers and its admin immediately — this can only be undone from the database.`, "Delete", () =>
                deleteVenue.mutate(v.id, { onError: onErr("Could not delete venue.") })
              )
            }
          />
          <Ionicon name="chevron-forward" size={16} color={colors.muted} className="ml-1" />
        </Link>
      ))}
    </SectionShell>
  );
}

function ListRow({ title, badge, sub, by, onDelete, deleteLabel }: { title: string; badge?: string; sub: string; by: string; onDelete: () => void; deleteLabel: string }) {
  return (
    <div className="flex items-center rounded-2xl border border-border bg-surface p-4">
      <div className="mr-3 min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</span>
          {badge && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-muted">{badge}</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
        <p className="mt-1 truncate text-xs text-primary-dark">{by}</p>
      </div>
      <IconButton icon="trash-outline" color={colors.danger} label={deleteLabel} onPress={onDelete} />
    </div>
  );
}

// Port of AllGamesListScreen — hard delete of any game/tournament.
export function AllGamesListPage() {
  const [search, setSearch] = useState("");
  const { data: games, isLoading } = useAllGames(search || undefined);
  const deleteGame = useDeleteGameAsSuperadmin();
  return (
    <SectionShell active="games" title="All Games" search={search} setSearch={setSearch} variants={["title", "game code"]} isLoading={isLoading} emptyIcon="trophy-outline" emptyText="No games found.">
      {(games ?? []).map((g) => (
        <ListRow
          key={g.id}
          title={g.title}
          badge={g.game_type === "TOURNAMENT" ? "Tournament" : "Game"}
          sub={`${g.sports?.name ?? "Sport not set"} · ${g.game_date} · ${g.status}`}
          by={g.profiles ? `By: ${g.profiles.full_name ?? g.profiles.email}` : "Creator unknown"}
          deleteLabel="Delete game"
          onDelete={() =>
            confirmDestructive("Delete Game/Tournament", `Permanently delete "${g.title}"? This removes it and all its teams/matches/invites for everyone — this cannot be undone.`, "Delete", () =>
              deleteGame.mutate(g.id, { onError: onErr("Could not delete game.") })
            )
          }
        />
      ))}
    </SectionShell>
  );
}

// Port of AllGroupsListScreen — disband any squad.
export function AllGroupsListPage() {
  const [search, setSearch] = useState("");
  const { data: squads, isLoading } = useAllSquads(search || undefined);
  const disband = useDisbandSquadAsSuperadmin();
  return (
    <SectionShell active="groups" title="All Squads" search={search} setSearch={setSearch} variants={["squad name", "squad code"]} isLoading={isLoading} emptyIcon="people-outline" emptyText="No squads found.">
      {(squads ?? []).map((s) => (
        <ListRow
          key={s.id}
          title={s.name}
          sub={`${s.sports?.name ?? "Sport not set"} · ${s.location ?? "Location not set"}`}
          by={s.profiles ? `Owner: ${s.profiles.full_name ?? s.profiles.email}` : "Owner unknown"}
          deleteLabel="Delete squad"
          onDelete={() =>
            confirmDestructive("Delete Squad", `Permanently delete "${s.name}"? This removes the squad and its members for everyone — this cannot be undone.`, "Delete", () =>
              disband.mutate(s.id, { onError: onErr("Could not delete squad.") })
            )
          }
        />
      ))}
    </SectionShell>
  );
}

// Port of AllEventsListScreen — delete any event.
export function AllEventsListPage() {
  const [search, setSearch] = useState("");
  const { data: events, isLoading } = useAllEvents(search || undefined);
  const disband = useDisbandEventAsSuperadmin();
  return (
    <SectionShell active="events" title="All Events" search={search} setSearch={setSearch} variants={["event name", "event code"]} isLoading={isLoading} emptyIcon="calendar-outline" emptyText="No events found.">
      {(events ?? []).map((ev) => (
        <ListRow
          key={ev.id}
          title={ev.name}
          sub={`${ev.event_type} · ${ev.location ?? "Location not set"}`}
          by={ev.profiles ? `Owner: ${ev.profiles.full_name ?? ev.profiles.email}` : "Owner unknown"}
          deleteLabel="Delete event"
          onDelete={() =>
            confirmDestructive("Delete Event", `Permanently delete "${ev.name}"? This removes the event and its members for everyone — this cannot be undone.`, "Delete", () =>
              disband.mutate(ev.id, { onError: onErr("Could not delete event.") })
            )
          }
        />
      ))}
    </SectionShell>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  game_message: "Game chat",
  team_message: "Team chat",
  event_message: "Event chat",
  squad_message: "Squad chat",
  community_message: "Community",
  profile: "Profile",
};

function ReportAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} className="flex items-center gap-1.5 text-xs font-semibold hover:underline" style={{ color }}>
      <Ionicon name={icon} size={15} color={color} />
      {label}
    </button>
  );
}

// Port of AdminModerationScreen — unreviewed content reports; remove the
// content, eject the reported user, or dismiss.
export function ModerationPage() {
  const viewerId = useAuthStore((s) => s.session?.user.id);
  const { data: reports, isLoading } = useContentReports();
  const removeContent = useRemoveReportedContent(viewerId);
  const ejectUser = useEjectUser(viewerId);
  const dismiss = useDismissReport(viewerId);
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports ?? [];
    return (reports ?? []).filter((r) =>
      [r.reported?.full_name, r.reported?.email, r.reporter?.full_name, r.reporter?.email, r.reason, r.message_snapshot, SOURCE_LABELS[r.source] ?? r.source].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [reports, search]);

  const remove = (r: ContentReport) => {
    if (r.source === "profile") return Alert.alert("Nothing to remove", 'A profile report has no message content to delete. Use "Eject User" instead.');
    confirmDestructive("Remove Content", "Permanently delete the reported message? This can't be undone.", "Remove", () => removeContent.mutate(r.id, { onError: onErr("Could not remove content.") }));
  };
  const eject = (r: ContentReport) => {
    const name = r.reported?.full_name ?? r.reported?.email ?? "this user";
    confirmDestructive(`Eject ${name}?`, "They'll be immediately signed out and unable to use the app again.", "Eject", () =>
      ejectUser.mutate({ reportId: r.id, userId: r.reported_user_id }, { onError: onErr("Could not eject user.") })
    );
  };

  return (
    <SectionShell
      active="moderation"
      title="Reports"
      search={search}
      setSearch={setSearch}
      variants={["reported user", "reporter", "reason"]}
      isLoading={isLoading}
      emptyIcon="flag-outline"
      emptyText={search.trim() ? `No reports match "${search.trim()}"` : "No reports."}
    >
      {visible.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary-dark">{SOURCE_LABELS[r.source] ?? r.source}</span>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">Unreviewed</span>
          </div>
          <p className="truncate text-sm font-semibold text-ink">Reported: {r.reported?.full_name ?? r.reported?.email ?? "Unknown user"}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            By {r.reporter?.full_name ?? r.reporter?.email ?? "Unknown"} · {r.reason}
          </p>
          {r.message_snapshot && <p className="mt-2 line-clamp-2 text-xs italic text-ink">"{r.message_snapshot}"</p>}
          <p className="mt-2 text-xs text-muted">{formatCommunityTimeAgo(r.created_at)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <ReportAction icon="trash-outline" label="Remove Content" color={colors.danger} onPress={() => remove(r)} />
            <ReportAction icon="person-remove-outline" label="Eject User" color={colors.danger} onPress={() => eject(r)} />
            <ReportAction icon="close-circle-outline" label="Dismiss" color={colors.muted} onPress={() => dismiss.mutate(r.id, { onError: onErr("Could not dismiss report.") })} />
          </div>
        </div>
      ))}
    </SectionShell>
  );
}

const TYPE_LABEL: Record<string, string> = { user: "Player", owner: "Venue Admin", superadmin: "Superadmin" };

// Port of AllUsersListScreen — the user directory; eject / reactivate.
export function AllUsersListPage() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAllUsers(search || undefined);
  const setActive = useSetUserActive();
  const eject = (u: AllUsersListItem) =>
    confirmDestructive(`Eject ${u.full_name ?? "this user"}?`, "They'll be immediately signed out and unable to use the app again, until reactivated here.", "Eject", () =>
      setActive.mutate({ userId: u.id, isActive: false }, { onError: onErr("Could not eject user.") })
    );
  const reactivate = (u: AllUsersListItem) =>
    Alert.alert(`Reactivate ${u.full_name ?? "this user"}?`, "They'll be able to sign in and use the app again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reactivate", onPress: () => setActive.mutate({ userId: u.id, isActive: true }, { onError: onErr("Could not reactivate user.") }) },
    ]);
  return (
    <SectionShell active="users" title="All Users" search={search} setSearch={setSearch} variants={["name", "email", "user code"]} isLoading={isLoading} emptyIcon="person-outline" emptyText="No users found.">
      {(users ?? []).map((u) => {
        const ejected = u.isactive === false;
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <Avatar url={u.avatar} name={u.full_name ?? "?"} size={44} />
            <div className="mr-2 min-w-0 flex-1">
              <p className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{u.full_name ?? "Unnamed"}</span>
                {ejected && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-danger">Ejected</span>}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{u.email ?? u.phone ?? "No contact info"}</p>
              <p className="mt-1 truncate text-xs text-primary-dark">
                {TYPE_LABEL[u.type] ?? u.type} · {u.user_code}
              </p>
            </div>
            {u.type === "superadmin" ? null : ejected ? (
              <button type="button" onClick={() => reactivate(u)} className="rounded-lg bg-primary-light px-3 py-2 text-xs font-semibold text-primary-dark">
                Reactivate
              </button>
            ) : (
              <IconButton icon="person-remove-outline" color={colors.danger} label="Eject user" onPress={() => eject(u)} />
            )}
          </div>
        );
      })}
    </SectionShell>
  );
}

// Port of CreateVenueScreen → on success, replace with that venue's Manage
// Admins page so an owner can be assigned straight away.
export function CreateVenuePage() {
  const p = useAdminPaths();
  const navigate = useAppNavigate();
  const createVenue = useCreateVenue();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("23:00");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const create = () => {
    if (!isValidName(name)) return Alert.alert("Invalid Name", `Venue name must be ${NAME_REQUIREMENT_HINT}.`);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return Alert.alert("Invalid Time", "Operating hours must be in HH:MM format, e.g. 06:00.");
    createVenue.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        startTime,
        endTime,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
      { onSuccess: (venue) => navigate(p.admins(venue.id), { replace: true, state: { currentAdminEmail: null } }), onError: onErr("Could not create venue.") }
    );
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string, maxLength?: number, inputMode?: "decimal") => (
    <div className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <FieldInput value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} aria-label={label} />
    </div>
  );

  return (
    <>
      <AdminPageHeader title="Create Venue" backTo={p.home} right={<GradientAction label="Create" onPress={create} pending={createVenue.isPending} />} />
      <PageBody narrow>
        <form onSubmit={(e) => (e.preventDefault(), create())}>
          {field("Venue Name", name, setName, "e.g. Elite Sports Arena", 80)}
          <div className="mb-4">
            <FieldLabel>Description</FieldLabel>
            <TextArea value={description} onChange={setDescription} placeholder="Describe this venue..." maxLength={500} label="Description" />
          </div>
          {field("Address", address, setAddress, "Street address", 200)}
          {field("City", city, setCity, "e.g. Karachi", 60)}
          <div className="grid grid-cols-2 gap-3">
            {field("Opens (HH:MM)", startTime, setStartTime, "06:00", 5)}
            {field("Closes (HH:MM)", endTime, setEndTime, "23:00", 5)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Latitude (optional)", latitude, setLatitude, "24.8607", undefined, "decimal")}
            {field("Longitude (optional)", longitude, setLongitude, "67.0011", undefined, "decimal")}
          </div>
          <button type="submit" className="hidden" />
        </form>
      </PageBody>
    </>
  );
}
