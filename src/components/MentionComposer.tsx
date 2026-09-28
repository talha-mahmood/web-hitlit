import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useMentionSearch } from "../hooks/useMentions";
import MentionSuggestionsList from "./MentionSuggestionsList";
import {
  findActiveMentionTrigger,
  insertMention,
  computeMentions,
  type Mention,
  type MentionCandidate,
  type MentionEntityType,
} from "../lib/mentionParser";
import type { MentionSuggestion } from "../lib/api/mentions";

function Avatar({ name, avatar, size = 32 }: { name: string | null; avatar: string | null; size?: number }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  if (avatar) {
    return <Image source={{ uri: avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} className="bg-primary-light" />;
  }
  return (
    <View className="bg-primary items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

// The one composer used both by the main Community Chat feed (dropdown
// opens downward, composer sits above the feed) and a comment thread's
// reply box (dropdown opens upward, composer sits at the bottom) — see
// dropdownPosition. Owns its own text/selection/mention state entirely;
// callers just get a finished (body, mentions) pair on submit.
export default function MentionComposer({
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
}: {
  avatarName: string | null;
  avatarUrl: string | null;
  placeholder: string;
  dropdownPosition: "above" | "below";
  onSend: (body: string, mentions: Mention[]) => void;
  sending?: boolean;
  // Present while editing an existing message — swaps the send button for
  // a Save/Cancel pair and prefills the draft from that message.
  editing?: { messageId: string; initialBody: string; initialMentions: Mention[] } | null;
  onSave?: (body: string, mentions: Mention[]) => void;
  onCancelEdit?: () => void;
  saving?: boolean;
}) {
  const [text, setText] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [confirmedTokens, setConfirmedTokens] = useState<MentionCandidate[]>([]);
  const [activeType, setActiveType] = useState<MentionEntityType | undefined>(undefined);

  // Enter/refresh edit mode whenever a *different* message is targeted.
  useEffect(() => {
    if (!editing) return;
    setText(editing.initialBody);
    setConfirmedTokens(
      editing.initialMentions.map((m) => ({ entityType: m.entityType, entityId: m.entityId, displayName: m.displayName }))
    );
    setSelection({ start: editing.initialBody.length, end: editing.initialBody.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.messageId]);

  const trigger = findActiveMentionTrigger(text, selection.start);
  const { data: suggestions, isLoading, isError } = useMentionSearch(trigger?.query ?? "", activeType);

  const handleChangeText = (next: string) => {
    setText(next);
  };

  const handleSelect = (item: MentionSuggestion) => {
    if (!trigger) return;
    const result = insertMention(text, trigger, selection.end, item);
    setText(result.text);
    setSelection({ start: result.cursor, end: result.cursor });
    setConfirmedTokens((prev) => [...prev, { entityType: item.entityType, entityId: item.entityId, displayName: item.displayName }]);
    setActiveType(undefined);
  };

  const reset = () => {
    setText("");
    setConfirmedTokens([]);
    setSelection({ start: 0, end: 0 });
    setActiveType(undefined);
  };

  const handleSubmit = () => {
    const body = text.trim();
    if (!body) return;
    // Compute against the trimmed string specifically — trimming can shift
    // every index, so this must run after trimming, not before.
    const finalMentions = computeMentions(body, confirmedTokens);
    if (editing) {
      onSave?.(body, finalMentions);
    } else {
      onSend(body, finalMentions);
      reset();
    }
  };

  const isBusy = editing ? !!saving : !!sending;
  const canSubmit = text.trim().length > 0 && !isBusy;

  return (
    <View
      className={`bg-white ${dropdownPosition === "above" ? "border-t" : "border-b"} border-border`}
      // The suggestions dropdown below (position="below") overflows past this
      // view's own box into the space of *later* siblings (the day-filter
      // row, the feed list) — without a higher stacking order here, those
      // later siblings would paint over it. Harmless when the dropdown opens
      // "above" instead, where default paint order already puts this on top.
      style={{ zIndex: 20, elevation: trigger ? 20 : 0 }}
    >
      {editing && (
        <View className="flex-row items-center justify-between px-4 pt-2.5 pb-1.5" style={{ backgroundColor: colors.primaryLight }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Ionicons name="pencil" size={13} color={colors.primaryDark} />
            <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
              Editing message
            </Text>
          </View>
          <Pressable
            onPress={() => {
              reset();
              onCancelEdit?.();
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={colors.primaryDark} />
          </Pressable>
        </View>
      )}
      <View className="flex-row items-center px-4 py-3" style={{ gap: 8 }}>
        <Avatar name={avatarName} avatar={avatarUrl} />
        <View className="flex-1" style={{ position: "relative" }}>
          <TextInput
            value={text}
            onChangeText={handleChangeText}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            selection={selection}
            placeholder={placeholder}
            className="flex-1 border border-border rounded-full px-4 py-2.5 text-ink"
            maxLength={1000}
            multiline
          />
          <MentionSuggestionsList
            visible={!!trigger}
            position={dropdownPosition}
            query={trigger?.query ?? ""}
            activeType={activeType}
            onChangeType={setActiveType}
            suggestions={suggestions ?? []}
            isLoading={isLoading}
            isError={isError}
            onSelect={handleSelect}
          />
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`w-10 h-10 rounded-full items-center justify-center ${canSubmit ? "bg-primary" : "bg-gray-200"}`}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={canSubmit ? "white" : colors.muted} />
          ) : (
            <Ionicons name={editing ? "checkmark" : "send"} size={16} color={canSubmit ? "white" : colors.muted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
