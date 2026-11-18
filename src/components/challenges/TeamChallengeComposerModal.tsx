import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GeneratedEntityVisual from "../GeneratedEntityVisual";
import { colors } from "../../constants/theme";
import { DAYS, TIME_SLOTS, isTimeSlotPast } from "../../lib/gameFormHelpers";
import { useSendTeamChallenge } from "../../hooks/useSquads";
import type { SquadListItem } from "../../lib/api/squads";
import type { TeamChallengeFormat } from "../../lib/api/teamChallenges";
import { challengeFormatsForSport } from "../../lib/teamChallengeFormats";

// Racquet sports are always played 1-a-side (Singles) or 2-a-side
// (Doubles) — a free-form "enter a number" field doesn't make sense there,
// so those sports get a plain 1/2 picker instead of the numeric text input
// every other (team-size) sport still uses.
const RACQUET_SPORTS = new Set(["padel", "tennis", "badminton", "pickleball", "table tennis"]);
import { getFriendlyErrorMessage } from "../../lib/friendlyError";


function requestKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function displayError(error: unknown) {
  return getFriendlyErrorMessage(error, "We couldn't send this challenge. Please try again.");
}

export default function TeamChallengeComposerModal({
  visible,
  senderTeams,
  opponent,
  initialFormat,
  onClose,
  onSent,
}: {
  visible: boolean;
  senderTeams: SquadListItem[];
  opponent: SquadListItem | null;
  initialFormat?: TeamChallengeFormat | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const teamIds = useMemo(() => senderTeams.map((team) => team.id).sort(), [senderTeams]);
  const sendChallenge = useSendTeamChallenge(teamIds);
  const [senderSquadId, setSenderSquadId] = useState(senderTeams[0]?.id ?? "");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(DAYS[0]?.iso ?? "");
  const [time, setTime] = useState("");
  const [format, setFormat] = useState<TeamChallengeFormat>("5v5");
  const [totalPlayers, setTotalPlayers] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(requestKey);
  const sportName = opponent?.sports?.name ?? "";
  const formats = useMemo(() => challengeFormatsForSport(sportName), [sportName]);
  const isRacquetSport = RACQUET_SPORTS.has(sportName.trim().toLowerCase());
  const matchingSenderTeams = useMemo(
    () => senderTeams.filter((team) => team.sport_id === opponent?.sport_id),
    [senderTeams, opponent?.sport_id]
  );

  useEffect(() => {
    if (!visible) return;
    setSenderSquadId(matchingSenderTeams[0]?.id ?? "");
    setVenue("");
    setDate(DAYS[0]?.iso ?? "");
    setTime("");
    setFormat(initialFormat && formats.some((option) => option.value === initialFormat) ? initialFormat : formats[0]?.value ?? "5v5");
    setTotalPlayers("");
    setIdempotencyKey(requestKey());
    sendChallenge.reset();
  }, [visible, matchingSenderTeams, formats, initialFormat, sendChallenge.reset]);

  const totalPlayersValue = Number(totalPlayers);
  const totalPlayersValid = totalPlayers.length > 0 && Number.isInteger(totalPlayersValue) && totalPlayersValue >= 1 && totalPlayersValue <= 20;
  const valid = Boolean(
    opponent && matchingSenderTeams.some((team) => team.id === senderSquadId) && senderSquadId !== opponent.id && formats.some((option) => option.value === format) && venue.trim().length >= 2 &&
    date && time && !isTimeSlotPast(date, time) && totalPlayersValid
  );
  const times = TIME_SLOTS.filter((slot) => !isTimeSlotPast(date, slot.value));

  async function submit() {
    if (!valid || !opponent) return;
    try {
      await sendChallenge.mutateAsync({
        senderSquadId,
        receiverSquadId: opponent.id,
        venue: venue.trim(),
        scheduledAt: new Date(`${date}T${time}:00+05:00`).toISOString(),
        matchFormat: format,
        sportId: opponent.sport_id!,
        idempotencyKey,
        totalPlayers: totalPlayersValue,
      });
      onSent();
    } catch {
      // Keep the form and idempotency key intact so retrying after a transient
      // network error cannot create a second challenge.
    }
  }

  const inputStyle = {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
    fontSize: 15,
  } as const;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 justify-center px-4" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ backgroundColor: "rgba(0,0,0,0.76)" }}>
        <View className="w-full overflow-hidden rounded-3xl border border-border bg-surface" style={{ maxHeight: "88%", maxWidth: 520, alignSelf: "center" }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-2">
            <View>
              <Text className="text-ink text-2xl font-extrabold">Send Challenge</Text>
              <Text className="mt-1 text-muted" numberOfLines={1}>vs {opponent?.name ?? "Team"}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close challenge form" hitSlop={10} className="h-10 w-10 items-center justify-center rounded-full bg-surfaceRaised">
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            {senderTeams.length > 1 ? (
              <>
                <Text className="mb-2 mt-4 text-ink font-semibold">Challenge from</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {matchingSenderTeams.map((team) => {
                    const selected = team.id === senderSquadId;
                    return (
                      <Pressable key={team.id} onPress={() => setSenderSquadId(team.id)} className="flex-row items-center rounded-2xl border px-3 py-2" style={{ borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : colors.surfaceRaised, gap: 8 }}>
                        <GeneratedEntityVisual id={team.id} name={team.name} sport={team.sports?.name} kind="team" imageUrl={team.icon_url} size={26} />
                        <Text className="text-ink font-semibold" numberOfLines={1}>{team.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : matchingSenderTeams[0] ? (
              <View className="mt-4 flex-row items-center" style={{ gap: 8 }}>
                <Ionicons name="shield-checkmark" size={17} color={colors.primary} />
                <Text className="text-muted">Sending as <Text className="text-ink font-semibold">{matchingSenderTeams[0].name}</Text></Text>
              </View>
            ) : null}

            <Text className="mb-2 mt-5 text-ink font-semibold">Venue</Text>
            <TextInput value={venue} onChangeText={setVenue} placeholder="Enter venue" placeholderTextColor={colors.muted} style={inputStyle} maxLength={160} returnKeyType="done" />

            <Text className="mb-2 mt-5 text-ink font-semibold">Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {DAYS.map((day) => {
                const selected = date === day.iso;
                return (
                  <Pressable key={day.iso} onPress={() => { setDate(day.iso); setTime(""); }} className="items-center rounded-2xl border px-3 py-2" style={{ minWidth: 62, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : colors.surfaceRaised }}>
                    <Text style={{ color: selected ? colors.primary : colors.muted, fontSize: 12 }}>{day.day}</Text>
                    <Text className="mt-0.5 text-ink font-bold">{day.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-5 flex-row items-center justify-between">
              <Text className="text-ink font-semibold">Time</Text>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 9 }}>
              {times.map((slot) => {
                const selected = time === slot.value;
                return (
                  <Pressable key={slot.value} onPress={() => setTime(slot.value)} className="rounded-xl border px-3 py-2" style={{ borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : colors.surfaceRaised }}>
                    <Text style={{ color: selected ? colors.primary : colors.ink, fontWeight: "600" }}>{slot.label}</Text>
                  </Pressable>
                );
              })}
              {times.length === 0 ? <Text className="py-2 text-muted">No future times left today</Text> : null}
            </ScrollView>

            <View className="mt-5 flex-row items-center justify-between">
              <Text className="text-ink font-semibold">{sportName} format</Text>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 9, paddingRight: 20 }}>
              {formats.map(({ value, label }) => {
                const selected = format === value;
                return (
                  <Pressable key={value} onPress={() => setFormat(value)} className="items-center rounded-xl border px-4 py-2.5" style={{ flexShrink: 0, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : colors.surfaceRaised }}>
                    <Text style={{ color: selected ? colors.primary : colors.ink, fontWeight: "700" }}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="mb-2 mt-5 text-ink font-semibold">Total players</Text>
            {isRacquetSport ? (
              <View className="flex-row" style={{ gap: 10 }}>
                {["1", "2"].map((value) => {
                  const selected = totalPlayers === value;
                  return (
                    <Pressable key={value} onPress={() => setTotalPlayers(value)} className="flex-1 items-center justify-center rounded-2xl border" style={{ minHeight: 52, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : colors.surfaceRaised }}>
                      <Text style={{ color: selected ? colors.primary : colors.ink, fontWeight: "700", fontSize: 16 }}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <TextInput
                  value={totalPlayers}
                  onChangeText={(value) => setTotalPlayers(value.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="e.g. 11"
                  placeholderTextColor={colors.muted}
                  style={inputStyle}
                  keyboardType="number-pad"
                  maxLength={2}
                  returnKeyType="done"
                />
                {totalPlayers.length > 0 && !totalPlayersValid ? (
                  <Text className="mt-1.5 text-xs" style={{ color: colors.danger }}>Enter a number from 1 to 20</Text>
                ) : null}
              </>
            )}

            {sendChallenge.error ? <Text className="mt-4 text-sm" style={{ color: colors.danger }}>{displayError(sendChallenge.error)}</Text> : null}
            <View className="mt-6 flex-row" style={{ gap: 10 }}>
              <Pressable onPress={onClose} disabled={sendChallenge.isPending} className="flex-1 items-center justify-center rounded-2xl border border-border bg-surfaceRaised" style={{ minHeight: 56 }}>
                <Text className="text-ink font-bold">Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={!valid || sendChallenge.isPending} className="flex-1 flex-row items-center justify-center rounded-2xl" style={{ minHeight: 56, backgroundColor: valid ? colors.primary : colors.primaryDark, opacity: valid ? 1 : 0.62, gap: 8 }}>
                {sendChallenge.isPending ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text className="text-white font-bold">{sendChallenge.isPending ? "Sending…" : "Send Challenge"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
