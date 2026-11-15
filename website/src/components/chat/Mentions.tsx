import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { colors } from "@app/constants/theme";
import { containsObjectionableContent } from "@app/lib/contentFilter";
import { useMentionEntityExists, useMentionSearch } from "@app/hooks/useMentions";
import {
  computeMentions,
  findActiveMentionTrigger,
  insertMention,
  splitTextWithMentions,
  type Mention,
  type MentionCandidate,
  type MentionEntityType,
} from "@app/lib/mentionParser";
import type { MentionSuggestion } from "@app/lib/api/mentions";
import { Alert } from "@/lib/alert";
import { useAppNavigate } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import { Avatar } from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { Ionicon, MCIcon } from "../icons/Icon";
import EmojiPickerSheet from "./EmojiPickerSheet";

const TYPE_FILTERS: { type: MentionEntityType | undefined; label: string; icon: string }[] = [
  { type: undefined, label: "All", icon: "apps-outline" },
  { type: "player", label: "Players", icon: "person-outline" },
  { type: "game", label: "Games", icon: "game-controller-outline" },
  { type: "tournament", label: "Tournaments", icon: "trophy-outline" },
  { type: "squad", label: "Squads", icon: "people-outline" },
];

const TYPE_META: Record<MentionEntityType, { icon: string; bg: string; fg: string; label: string }> = {
  player: { icon: "account", bg: "rgb(var(--jz-blue-50))", fg: "#2563EB", label: "Player" },
  game: { icon: "calendar-star", bg: "rgb(var(--jz-green-50))", fg: colors.primaryDark, label: "Game" },
  tournament: { icon: "trophy", bg: "rgb(var(--jz-amber-50))", fg: "#D97706", label: "Tournament" },
  squad: { icon: "account-group", bg: "#FDF2F8", fg: "#DB2777", label: "Squad" },
};

// Port of MentionSuggestionsList — type filter pills + result rows, anchored
// above or below the composer. Arrow keys / Enter work on desktop.
function MentionSuggestionsList({
  position,
  query,
  activeType,
  onChangeType,
  suggestions,
  isLoading,
  isError,
  highlighted,
  onSelect,
}: {
  position: "above" | "below";
  query: string;
  activeType: MentionEntityType | undefined;
  onChangeType: (type: MentionEntityType | undefined) => void;
  suggestions: MentionSuggestion[];
  isLoading: boolean;
  isError: boolean;
  highlighted: number;
  onSelect: (item: MentionSuggestion) => void;
}) {
  return (
    <div
      className={`absolute inset-x-0 z-30 overflow-hidden rounded-2xl border border-border bg-surface shadow-hero ${
        position === "above" ? "bottom-full mb-2" : "top-full mt-2"
      }`}
      role="listbox"
      // Keep focus in the textarea while clicking inside the dropdown.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-border px-2.5 py-2">
        {TYPE_FILTERS.map((f) => {
          const active = activeType === f.type;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => onChangeType(f.type)}
              className={`flex shrink-0 items-center gap-[5px] rounded-full px-3 py-[7px] text-xs font-semibold ${active ? "bg-primary text-white" : "bg-gray-100 text-muted"}`}
            >
              <Ionicon name={f.icon} size={13} color={active ? "white" : colors.muted} />
              {f.label}
            </button>
          );
        })}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size={18} />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center px-4 py-6">
          <Ionicon name="cloud-offline-outline" size={20} color={colors.muted} />
          <p className="mt-1.5 text-center text-xs text-muted">Couldn't search right now.</p>
        </div>
      ) : query.trim().length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">Keep typing a name to find a player, game, tournament, or squad.</p>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-6">
          <Ionicon name="search-outline" size={20} color={colors.muted} />
          <p className="mt-1.5 text-center text-xs text-muted">No matches for "{query.trim()}".</p>
        </div>
      ) : (
        <div className="max-h-[230px] overflow-y-auto">
          {suggestions.map((item, i) => {
            const meta = TYPE_META[item.entityType];
            return (
              <button
                key={`${item.entityType}:${item.entityId}`}
                type="button"
                role="option"
                aria-selected={i === highlighted}
                onClick={() => onSelect(item)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${i === highlighted ? "bg-gray-50" : "hover:bg-gray-50"}`}
              >
                {item.entityType === "player" && item.avatar ? (
                  <Avatar url={item.avatar} name={item.displayName} size={36} />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
                    <MCIcon name={meta.icon} size={18} color={meta.fg} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{item.displayName}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{item.subtitle}</span>
                </span>
                <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Port of MentionComposer — the one composer for the community feed (dropdown
// below) and comment threads (dropdown above). Owns text, cursor and
// confirmed-mention state; callers get a finished (body, mentions) pair.
// Desktop: Enter sends, Shift+Enter adds a line. Touch keyboards: Enter is a
// new line and the send button sends, like the app.
export function MentionComposer({
  avatarName,
  avatarUrl,
  placeholder,
  dropdownPosition,
  onSend,
  sending,
  editing,
  onSave,
  onCancelEdit,
  saving,
  onPressPoll,
  autoFocus,
  className,
}: {
  avatarName: string | null;
  avatarUrl: string | null;
  placeholder: string;
  dropdownPosition: "above" | "below";
  onSend: (body: string, mentions: Mention[]) => void;
  sending?: boolean;
  editing?: { messageId: string; initialBody: string; initialMentions: Mention[] } | null;
  onSave?: (body: string, mentions: Mention[]) => void;
  onCancelEdit?: () => void;
  saving?: boolean;
  onPressPoll?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [confirmedTokens, setConfirmedTokens] = useState<MentionCandidate[]>([]);
  const [activeType, setActiveType] = useState<MentionEntityType | undefined>(undefined);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const pendingCursor = useRef<number | null>(null);

  // Auto-grow up to 140px, then scroll (WhatsApp-style box).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    if (pendingCursor.current != null) {
      el.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [text]);

  const placeCursor = (pos: number) => {
    setCursor(pos);
    pendingCursor.current = pos;
    ref.current?.focus();
  };

  useEffect(() => {
    if (!editing) return;
    setText(editing.initialBody);
    setConfirmedTokens(editing.initialMentions.map((m) => ({ entityType: m.entityType, entityId: m.entityId, displayName: m.displayName })));
    placeCursor(editing.initialBody.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.messageId]);

  // Text typed right after a mention that was already picked (e.g. "@Sara Khan
  // ok") still parses as an "@" token — it isn't a new search, so no dropdown
  // (and Enter sends instead of picking a suggestion).
  const rawTrigger = findActiveMentionTrigger(text, cursor);
  const trigger =
    rawTrigger && confirmedTokens.some((t) => rawTrigger.query.startsWith(`${t.displayName} `)) ? null : rawTrigger;
  const { data: suggestions, isLoading, isError } = useMentionSearch(trigger?.query ?? "", activeType);
  const list = suggestions ?? [];

  useEffect(() => setHighlighted(0), [trigger?.query, activeType, list.length]);

  const handleSelect = (item: MentionSuggestion) => {
    if (!trigger) return;
    const result = insertMention(text, trigger, cursor, item);
    setText(result.text);
    placeCursor(result.cursor);
    setConfirmedTokens((prev) => [...prev, { entityType: item.entityType, entityId: item.entityId, displayName: item.displayName }]);
    setActiveType(undefined);
  };

  const reset = () => {
    setText("");
    setConfirmedTokens([]);
    setCursor(0);
    setActiveType(undefined);
  };

  const isBusy = editing ? !!saving : !!sending;
  const canSubmit = text.trim().length > 0 && !isBusy;

  const handleSubmit = () => {
    const body = text.trim();
    if (!body || isBusy) return;
    if (containsObjectionableContent(body)) {
      Alert.alert("Message not sent", "Your message contains language that violates our community guidelines.");
      return;
    }
    const finalMentions = computeMentions(body, confirmedTokens);
    if (editing) onSave?.(body, finalMentions);
    else {
      onSend(body, finalMentions);
      reset();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger && list.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % list.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + list.length) % list.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelect(list[highlighted]);
        return;
      }
    }
    if (e.key === "Escape" && editing) {
      reset();
      onCancelEdit?.();
      return;
    }
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (e.key === "Enter" && !e.shiftKey && finePointer && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const syncCursor = () => setCursor(ref.current?.selectionStart ?? 0);

  return (
    <div className={`relative z-20 border-border bg-surface ${dropdownPosition === "above" ? "border-t" : "border-b"} ${className ?? ""}`}>
      {editing && (
        <div className="flex items-center justify-between bg-primary-light px-4 pb-1.5 pt-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-dark">
            <Ionicon name="pencil" size={13} color={colors.primaryDark} />
            Editing message
          </span>
          <button
            type="button"
            aria-label="Cancel editing"
            onClick={() => {
              reset();
              onCancelEdit?.();
            }}
          >
            <Ionicon name="close" size={16} color={colors.primaryDark} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        <div className="mb-1">
          <Avatar url={avatarUrl} name={avatarName} size={32} />
        </div>
        {onPressPoll && !editing && (
          <button type="button" onClick={onPressPoll} aria-label="Create poll" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light hover:brightness-95">
            <Ionicon name="bar-chart-outline" size={17} color={colors.primary} />
          </button>
        )}
        <button type="button" onClick={() => setEmojiOpen(true)} aria-label="Insert emoji" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light hover:brightness-95">
          <Ionicon name="happy-outline" size={18} color={colors.primary} />
        </button>
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCursor(e.target.selectionStart);
            }}
            onSelect={syncCursor}
            onKeyUp={syncCursor}
            onClick={syncCursor}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            maxLength={1000}
            rows={1}
            autoFocus={autoFocus}
            aria-label={placeholder}
            className="block max-h-[140px] min-h-[44px] w-full resize-none rounded-2xl border border-border px-4 py-[11px] text-sm leading-5 text-ink outline-none placeholder:text-muted focus:border-primary"
          />
          {trigger && (
            <MentionSuggestionsList
              position={dropdownPosition}
              query={trigger.query}
              activeType={activeType}
              onChangeType={setActiveType}
              suggestions={list}
              isLoading={isLoading}
              isError={isError}
              highlighted={highlighted}
              onSelect={handleSelect}
            />
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label={editing ? "Save" : "Send"}
          className={`mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${canSubmit ? "press bg-brand" : "bg-gray-200"}`}
        >
          {isBusy ? <Spinner size={16} color={canSubmit ? "white" : colors.muted} /> : <Ionicon name={editing ? "checkmark" : "send"} size={16} color={canSubmit ? "white" : colors.muted} />}
        </button>
      </div>
      <EmojiPickerSheet
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onPick={(emoji) => {
          const start = ref.current?.selectionStart ?? cursor;
          const end = ref.current?.selectionEnd ?? cursor;
          setText((t) => t.slice(0, start) + emoji + t.slice(end));
          placeCursor(start + emoji.length);
          setEmojiOpen(false);
        }}
      />
    </div>
  );
}

const ENTITY_LABEL: Record<Mention["entityType"], string> = { player: "player", game: "game", tournament: "tournament", squad: "squad" };

// Port of MentionText — plain text stays plain, each stored mention is a
// highlighted link that first checks the entity still exists.
export function MentionText({ body, mentions, className }: { body: string; mentions: Mention[] | null | undefined; className?: string }) {
  const navigate = useAppNavigate();
  const checkExists = useMentionEntityExists();
  const [checkingKey, setCheckingKey] = useState<string | null>(null);

  const open = async (mention: Mention) => {
    const key = `${mention.entityType}:${mention.entityId}`;
    if (checkingKey) return;
    setCheckingKey(key);
    try {
      if (!(await checkExists(mention.entityType, mention.entityId))) {
        Alert.alert("No longer available", `This ${ENTITY_LABEL[mention.entityType]} has been removed or is no longer available.`);
        return;
      }
      if (mention.entityType === "player") navigate(paths.player(mention.entityId));
      else if (mention.entityType === "squad") navigate(paths.squad(mention.entityId));
      else navigate(paths.game(mention.entityId));
    } finally {
      setCheckingKey(null);
    }
  };

  return (
    <p className={`whitespace-pre-wrap break-words ${className ?? ""}`}>
      {splitTextWithMentions(body, mentions).map((segment, i) => {
        if (segment.type === "text") return <span key={i}>{segment.text}</span>;
        const key = `${segment.mention.entityType}:${segment.mention.entityId}`;
        return (
          <button
            key={i}
            type="button"
            onClick={() => open(segment.mention)}
            className="inline font-bold text-primary hover:underline"
            style={{ opacity: checkingKey === key ? 0.5 : 1 }}
          >
            {segment.text}
          </button>
        );
      })}
    </p>
  );
}
