import { useEffect, useState, type MouseEvent } from "react";
import { colors } from "@app/constants/theme";
import type { SquadGroupType, SquadListItem } from "@app/lib/api/squads";
import { SQUAD_SKILL_COLORS } from "@app/lib/badgeColors";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { imageUrl } from "@/lib/cn";
import { AvatarStack } from "../ui/Avatar";
import Modal, { ClearApplyFooter } from "../ui/Modal";
import { Ionicon, MCIcon } from "../icons/Icon";
import GeneratedEntityVisual from "../GeneratedEntityVisual";

export const GROUP_TYPE_LABELS: Record<SquadGroupType, string> = {
  group: "Group",
  club: "Club",
  training_camp: "Training Camp",
  team: "Team",
};

const GROUP_TYPE_OPTIONS: SquadGroupType[] = ["team", "club"];

// Port of SquadsListScreen's SquadCard: name (+ custom icon), location,
// member stack + count, sport pill, skill pill + creator; the Join / Joined /
// Requested / Full / gender-only CTA pinned top-right and the sport photo in
// a green disc on the right edge (same shape as GameCard).
export default function SquadCard({
  squad,
  onPress,
  onJoinPress,
  currentUserId,
  myGender,
  index = 0,
}: {
  squad: SquadListItem;
  onPress: () => void;
  onJoinPress: () => void;
  currentUserId?: string;
  myGender?: string | null;
  index?: number;
}) {
  const active = squad.squad_members.filter((m) => m.status === "ACTIVE");
  const isFull = !!squad.max_players && active.length >= squad.max_players;
  const isClosedToJoins = isFull || squad.join_requests_blocked;
  const isMySquad = squad.squad_owner_id === currentUserId;
  const hasJoined = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "ACTIVE");
  const hasRequested = squad.squad_members.some((m) => m.user_id === currentUserId && m.status === "PENDING");
  const isGenderRestricted = squad.gender !== "mixed" && (!myGender || myGender !== squad.gender) && !hasJoined && !hasRequested;
  const skill = squad.skill_level;
  const skillColor = skill ? SQUAD_SKILL_COLORS[skill] : null;
  const sportName = squad.sports?.name ?? "";
  const sportPhoto = imageUrl(getSportImage(sportName));
  const glyph = getSportIcon(sportName);

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => e.key === "Enter" && onPress()}
      className="press relative min-h-[146px] animate-fadeUp cursor-pointer overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition-shadow hover:shadow-hero"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="absolute right-2.5 top-2.5 z-[5] text-[11.5px]">
        {isClosedToJoins && !hasJoined ? (
          <span className="block rounded-2xl bg-red-50 px-2 py-1 font-bold text-red-600">Full</span>
        ) : !isMySquad && isGenderRestricted ? (
          <span className="block rounded-2xl bg-gray-100 px-2 py-1 font-bold text-muted">{squad.gender === "male" ? "Male Only" : "Female Only"}</span>
        ) : hasJoined || isMySquad ? (
          <span className="flex min-w-[60px] items-center justify-center gap-[3px] rounded-2xl bg-green-50 px-2 py-1 font-semibold text-primary">
            <Ionicon name="checkmark-circle" size={13} color={colors.primary} />
            Joined
          </span>
        ) : hasRequested ? (
          <button type="button" onClick={stop(onJoinPress)} className="min-w-[60px] rounded-2xl bg-orange-50 px-2 py-1 font-semibold text-orange-600">
            Requested
          </button>
        ) : (
          <button type="button" onClick={stop(onJoinPress)} className="min-w-[60px] rounded-2xl bg-brand px-2 py-1 font-bold text-white shadow-cta transition active:scale-95">
            Join
          </button>
        )}
      </div>

      {/* The squad's own (custom or generated) badge in the green disc. */}
      <span className="pointer-events-none absolute -right-7 top-11 flex h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-full bg-primary-light">
        <GeneratedEntityVisual
          id={squad.id}
          name={squad.name}
          sport={sportName}
          kind={squad.group_type === "team" ? "team" : "squad"}
          imageUrl={squad.icon_url}
          size={48}
          style={{ marginRight: 17 }}
        />
      </span>

      <div className="px-2.5 pb-2 pt-2">
        <div className="mb-1 flex items-center gap-1.5 pr-20">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[4.4px] bg-primary-light">
            {sportPhoto ? (
              <img src={sportPhoto} alt="" className="h-[13px] w-[22px] object-contain" />
            ) : sportName ? (
              <MCIcon name={glyph.icon} size={14} color={glyph.fg} style={{ opacity: 0.8 }} />
            ) : (
              <Ionicon name="people" size={13} color={colors.primary} style={{ opacity: 0.8 }} />
            )}
          </span>
          <p className="flex-1 truncate text-sm font-extrabold text-ink">{squad.name}</p>
        </div>
        <p className="mb-1 flex items-center gap-1 pr-[92px] text-[11.5px] text-muted">
          <Ionicon name="location-outline" size={12} color={colors.muted} />
          <span className="truncate">{squad.location ?? "Location not set"}</span>
        </p>
        <div className="mb-1.5 flex items-center gap-[5px] pr-[92px]">
          <AvatarStack people={active.map((m) => ({ avatar: m.profiles?.avatar ?? null, name: m.profiles?.full_name ?? null }))} size={20} />
          <span className="truncate text-[11.5px] font-medium text-muted">
            {active.length} member{active.length !== 1 ? "s" : ""}
            {squad.max_players ? ` · ${active.length}/${squad.max_players}` : ""}
          </span>
        </div>
        {squad.sports && (
          <span className="inline-block rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">{squad.sports.name}</span>
        )}
        <div className="mt-1.5 flex items-center pr-[92px]">
          {skillColor && skill && (
            <>
              <span className="flex items-center gap-1 rounded-full px-[9px] py-1 text-[11px] font-bold text-white" style={{ backgroundColor: skillColor }}>
                <Ionicon name="stats-chart" size={11} color="white" />
                {skill.charAt(0).toUpperCase() + skill.slice(1)}
              </span>
              <span className="mx-2 h-4 w-px bg-border" />
            </>
          )}
          <Ionicon name="person-outline" size={13} color={colors.muted} style={{ marginRight: 4 }} />
          <span className="flex-1 truncate text-xs text-muted">{squad.profiles?.full_name ?? "Unknown"}</span>
        </div>
      </div>
    </div>
  );
}

// Port of SelectGroupTypeModal: Team / Club multi-select, picks stay
// local until Apply.
export function SelectGroupTypeSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: SquadGroupType[]; onApply: (types: SquadGroupType[]) => void }) {
  const [draft, setDraft] = useState<SquadGroupType[]>(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const toggle = (t: SquadGroupType) => setDraft((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));

  return (
    <Modal open={open} onClose={onClose} title="Filter by Squad Type" subtitle="Pick any number of squad types" footer={<ClearApplyFooter onClear={() => onApply([])} onApply={() => onApply(draft)} />}>
      <div className="mb-5 flex flex-wrap gap-2">
        {GROUP_TYPE_OPTIONS.map((t) => {
          const selected = draft.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(t)}
              className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-[9px] text-[13.5px] ${selected ? "border-primary bg-brand font-bold text-white" : "border-border bg-surface font-medium text-ink hover:border-primary/40"}`}
            >
              {selected && <Ionicon name="checkmark" size={13} color="white" />}
              {GROUP_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
