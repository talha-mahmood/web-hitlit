import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useCreateCricketMatch } from "../../hooks/useCricket";
import { friendlyCricketError } from "../../lib/api/cricket";
import { useLinkCricketMatch } from "../../hooks/useTournamentMatches";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import AddPlayersFromGroupModal from "../../components/AddPlayersFromGroupModal";
import GradientFill from "../../components/GradientFill";
import { namesClash, entryCollides, hasBlockingDuplicateNames, disambiguateRoster, type NamedEntry } from "../../lib/matchNameValidation";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

// A roster entry typed by hand has no real identity behind it (sourceId:
// null) — two of those with the same name are genuinely indistinguishable,
// so that still blocks. One added via "Add From a Group" carries its real
// squad_members row id, so it can share a display name with a different
// real person without being treated as a duplicate (see matchNameValidation).
type PlayerEntry = NamedEntry;

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "NewMatch">;
type Route = RouteProp<ScorecardStackParamList, "NewMatch">;

const LOCKED_FIELD_STYLE = { backgroundColor: "#F3F4F6" };

const OVERS_PRESETS = ["2", "5", "10", "20", "50"];

function IconBadge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View
      className="items-center justify-center rounded-xl"
      style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
    >
      <Ionicons name={icon} size={17} color={colors.primaryDark} />
    </View>
  );
}

function CardSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
      <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
        <IconBadge icon={icon} />
        <Text className="text-ink font-bold text-base">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function TeamCard({
  letter,
  players,
  name,
  onNameChange,
  onPlayersChange,
  nameLocked,
  playersLocked,
  otherTeamName,
  otherTeamPlayers,
}: {
  letter: "A" | "B";
  players: PlayerEntry[];
  name: string;
  onNameChange: (v: string) => void;
  onPlayersChange: (players: PlayerEntry[]) => void;
  nameLocked?: boolean;
  playersLocked?: boolean;
  // The sibling team's current name/roster — needed so a name can't be
  // reused across teams, not just within this one.
  otherTeamName: string;
  otherTeamPlayers: PlayerEntry[];
}) {
  const [draft, setDraft] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const addPlayer = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Typed by hand, so it has no sourceId — can't be proven different from
    // an existing same-named entry, so any collision here still blocks.
    if (entryCollides({ name: trimmed, sourceId: null }, [...players, ...otherTeamPlayers])) {
      setAddError("Someone with this name is already in the match.");
      return;
    }
    onPlayersChange([...players, { name: trimmed, sourceId: null }]);
    setDraft("");
    setAddError(null);
  };

  const teamNameClash = namesClash(name, otherTeamName);

  return (
    <View className="bg-white rounded-2xl overflow-hidden mb-4" style={cardShadow}>
      <View
        className="flex-row items-center px-4 py-3"
        style={{ gap: 10, backgroundColor: colors.primaryLight }}
      >
        <GradientFill
          className="items-center justify-center rounded-full"
          style={{ width: 30, height: 30 }}
        >
          <Text className="text-white font-extrabold text-sm">{letter}</Text>
        </GradientFill>
        <Ionicons name="shirt-outline" size={18} color={colors.primaryDark} />
        <View className="flex-1">
          <Text className="text-ink font-bold text-sm">Team {letter}</Text>
          <Text className="text-muted text-xs">Enter team name and players</Text>
        </View>
        <View
          className="flex-row items-center rounded-full px-2.5 py-1"
          style={{ gap: 4, backgroundColor: "white" }}
        >
          <Ionicons name="people" size={12} color={colors.primaryDark} />
          <Text className="text-xs font-bold" style={{ color: colors.primaryDark }}>
            {players.length} player{players.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View className="px-4 pt-4 pb-4">
        <Text className="text-ink font-semibold text-sm mb-2">
          Team {letter} Name <Text className="text-red-500">*</Text>
        </Text>
        <FieldInput
          value={name}
          onChangeText={onNameChange}
          placeholder={letter === "A" ? "e.g. Strikers" : "e.g. Warriors"}
          maxLength={40}
          editable={!nameLocked}
          containerStyle={nameLocked ? LOCKED_FIELD_STYLE : undefined}
          right={
            name.length > 0 && !nameLocked ? (
              <Pressable onPress={() => onNameChange("")} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />
        {teamNameClash && (
          <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
            Team A and Team B can't have the same name.
          </Text>
        )}

        <Text className="text-ink font-semibold text-sm mb-2 mt-4">
          Team {letter} Players <Text className="text-red-500">*</Text>
        </Text>
        {!playersLocked && (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View className="flex-1">
            <FieldInput
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                setAddError(null);
              }}
              placeholder="Add player name"
              onSubmitEditing={addPlayer}
              returnKeyType="done"
              left={<Ionicons name="person-outline" size={17} color={colors.muted} style={{ marginRight: 8 }} />}
            />
          </View>
          <Pressable
            onPress={addPlayer}
            disabled={!draft.trim()}
          >
            {draft.trim() ? (
              <GradientFill className="w-11 h-11 rounded-xl items-center justify-center">
                <Ionicons name="add" size={20} color="white" />
              </GradientFill>
            ) : (
              <View className="w-11 h-11 rounded-xl items-center justify-center bg-gray-200">
                <Ionicons name="add" size={20} color="white" />
              </View>
            )}
          </Pressable>
        </View>
        )}
        {addError && (
          <Text className="text-xs mt-1.5" style={{ color: colors.danger }}>
            {addError}
          </Text>
        )}
        {!playersLocked && (
          <Pressable
            onPress={() => setShowGroupModal(true)}
            className="flex-row items-center justify-center rounded-xl py-2.5 mt-2.5"
            style={{ gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
          >
            <Ionicons name="people-outline" size={16} color={colors.primaryDark} />
            <Text className="text-sm font-semibold" style={{ color: colors.primaryDark }}>
              Add From a Group
            </Text>
          </Pressable>
        )}
        {playersLocked && players.length < 2 && (
          <Text className="text-xs mt-1" style={{ color: colors.danger }}>
            Cricket needs at least 2 players per team — add more players to this team in the tournament first.
          </Text>
        )}
        {players.length > 0 && (
          <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
            {players.map((p, i) => (
              <View
                key={`${p.name}-${i}`}
                className="flex-row items-center bg-primary-light rounded-full pl-3 pr-2 py-1.5"
                style={{ gap: 6 }}
              >
                <Text className="text-primary text-sm font-medium">{p.name}</Text>
                {!playersLocked && (
                  <Pressable onPress={() => onPlayersChange(players.filter((_, idx) => idx !== i))} hitSlop={6}>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <AddPlayersFromGroupModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        excludedUserIds={[...players, ...otherTeamPlayers].map((p) => p.sourceId).filter((id): id is string => !!id)}
        onAdd={(picked) => onPlayersChange([...players, ...picked.map((p) => ({ name: p.name, sourceId: p.userId }))])}
      />
    </View>
  );
}

export default function NewMatchScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const prefill = params?.prefill;
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const createMatch = useCreateCricketMatch();
  const linkCricketMatch = useLinkCricketMatch(prefill?.gameId ?? "");

  const [teamAName, setTeamAName] = useState(prefill?.teamAName ?? "");
  const [teamBName, setTeamBName] = useState(prefill?.teamBName ?? "");
  // Players come pre-filled from the tournament roster and are locked. Those
  // are plain names off the roster, not a verified group pick, so they
  // start with no sourceId — same as typing them by hand.
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerEntry[]>(
    (prefill?.teamAPlayers ?? []).map((name) => ({ name, sourceId: null }))
  );
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerEntry[]>(
    (prefill?.teamBPlayers ?? []).map((name) => ({ name, sourceId: null }))
  );
  const [oversLimit, setOversLimit] = useState<string | null>(null);
  const [format, setFormat] = useState<"T10" | "T20" | "ODI" | "Club" | null>(null);
  const [tossWinner, setTossWinner] = useState<"A" | "B" | null>(null);
  const [tossDecision, setTossDecision] = useState<"BAT" | "BOWL" | null>(null);
  const [venue, setVenue] = useState(prefill?.venue ?? "");

  const isValid =
    teamAName.trim().length > 0 &&
    teamBName.trim().length > 0 &&
    !namesClash(teamAName, teamBName) &&
    teamAPlayers.length >= 2 &&
    teamBPlayers.length >= 2 &&
    !hasBlockingDuplicateNames([...teamAPlayers, ...teamBPlayers]) &&
    !!oversLimit &&
    parseInt(oversLimit, 10) > 0 &&
    !!format &&
    !!tossWinner &&
    !!tossDecision;

  const handleCreate = () => {
    if (!isValid || !userId || !oversLimit || !format || !tossWinner || !tossDecision) return;
    // Two different real people can share a display name (allowed when
    // they're picked from a group with distinct accounts) — but the match
    // row only stores plain name text, and the scoring engine tracks every
    // stat by that text, so same-named entries need a disambiguating suffix
    // before they're saved or they'd become impossible to tell apart once
    // scoring starts (e.g. picking a non-striker with that name).
    const { teamANames, teamBNames } = disambiguateRoster(teamAPlayers, teamBPlayers);
    createMatch.mutate(
      {
        userId,
        teamAName: teamAName.trim(),
        teamBName: teamBName.trim(),
        teamAPlayers: teamANames,
        teamBPlayers: teamBNames,
        oversLimit: parseInt(oversLimit, 10),
        format,
        tossWinner,
        tossDecision,
        venue: venue.trim() || undefined,
      },
      {
        onSuccess: ({ matchId }) => {
          if (prefill) {
            linkCricketMatch.mutate({ matchId: prefill.tournamentMatchId, cricketMatchId: matchId });
          }
          navigation.replace("LiveScoring", { matchId });
        },
        onError: (err) => Alert.alert("Error", friendlyCricketError(err, "Could not create match.")),
      }
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="overflow-hidden" style={{ paddingTop: insets.top + 16, paddingBottom: 16 }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: colors.primaryLight,
            opacity: 0.5,
            top: -110,
            right: -60,
          }}
        />

        {/* Grass mound — a big circle peeking up from the bottom-right
            corner, cheaper than a real grass silhouette but reads the same
            at this size. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: "#4ADE80",
            bottom: -230,
            right: -70,
          }}
        />

        {/* Stumps: three tan bars with two bails resting on top. */}
        <View pointerEvents="none" style={{ position: "absolute", right: 74, bottom: 8, flexDirection: "row" }}>
          <View style={{ position: "absolute", top: -5, left: 1, width: 15, height: 4, borderRadius: 2, backgroundColor: "#C9A46B" }} />
          <View style={{ position: "absolute", top: -5, left: 15, width: 15, height: 4, borderRadius: 2, backgroundColor: "#C9A46B" }} />
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 7,
                height: 62,
                marginLeft: i === 0 ? 0 : 7,
                borderRadius: 3,
                backgroundColor: "#C9A46B",
              }}
            />
          ))}
        </View>

        {/* Ball, overlapping the stumps at their base. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 34,
            bottom: 14,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#DC2626",
            borderWidth: 1,
            borderColor: "#991B1B",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 15,
              left: -4,
              width: 42,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.75)",
              transform: [{ rotate: "-18deg" }],
            }}
          />
        </View>

        <View className="flex-row items-center px-4" style={{ gap: 6 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">New Match</Text>
            <Text className="text-muted text-sm mt-0.5">Set up your match details</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {prefill && (
          <View className="flex-row rounded-xl px-3 py-2.5 mb-4" style={{ backgroundColor: colors.primaryLight, gap: 8 }}>
            <Ionicons name="information-circle" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
            <Text className="text-xs flex-1" style={{ color: colors.primaryDark }}>
              Team names, players and venue come from the tournament match and can't be changed here — everything else is up to you.
            </Text>
          </View>
        )}

        <TeamCard letter="A" name={teamAName} onNameChange={setTeamAName} players={teamAPlayers} onPlayersChange={setTeamAPlayers} nameLocked={!!prefill} playersLocked={!!prefill} otherTeamName={teamBName} otherTeamPlayers={teamBPlayers} />
        <TeamCard letter="B" name={teamBName} onNameChange={setTeamBName} players={teamBPlayers} onPlayersChange={setTeamBPlayers} nameLocked={!!prefill} playersLocked={!!prefill} otherTeamName={teamAName} otherTeamPlayers={teamAPlayers} />

        <CardSection icon="location-outline" title="Venue">
          <FieldInput
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. Karachi Cricket Ground"
            maxLength={60}
            editable={!prefill}
            containerStyle={prefill ? LOCKED_FIELD_STYLE : undefined}
          />
        </CardSection>

        <CardSection icon="baseball-outline" title="Overs per Innings">
          <PillRow
            options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))}
            value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null}
            onChange={setOversLimit}
          />
          <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom number</Text>
          <FieldInput
            value={oversLimit ?? ""}
            onChangeText={(t) => setOversLimit(t.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="e.g. 15"
            keyboardType="number-pad"
            maxLength={3}
          />
        </CardSection>

        <CardSection icon="trophy-outline" title="Match Format">
          <PillRow
            options={[
              { label: "T10", value: "T10" as const },
              { label: "T20", value: "T20" as const },
              { label: "One Day", value: "ODI" as const },
              { label: "Club Cricket", value: "Club" as const },
            ]}
            value={format}
            onChange={setFormat}
          />
        </CardSection>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <CardSection icon="trophy-outline" title="Toss Winner">
              <PillRow
                options={[
                  { label: teamAName.trim() || "Team A", value: "A" as const },
                  { label: teamBName.trim() || "Team B", value: "B" as const },
                ]}
                value={tossWinner}
                onChange={setTossWinner}
              />
            </CardSection>
          </View>
          <View className="flex-1">
            <CardSection icon="albums-outline" title="Toss Decision">
              <PillRow
                options={[
                  { label: "Bat", value: "BAT" as const },
                  { label: "Bowl", value: "BOWL" as const },
                ]}
                value={tossDecision}
                onChange={setTossDecision}
              />
            </CardSection>
          </View>
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={!isValid || createMatch.isPending}
          style={isValid ? primaryButtonShadow : undefined}
        >
          {isValid ? (
            <GradientFill className="flex-row items-center justify-center rounded-2xl py-4 mt-2" style={{ gap: 8 }}>
              {createMatch.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="white" />
                  <Text className="font-bold text-base text-white">Start Match</Text>
                </>
              )}
            </GradientFill>
          ) : (
            <View className="flex-row items-center justify-center rounded-2xl py-4 mt-2 bg-gray-200" style={{ gap: 8 }}>
              {createMatch.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color={colors.muted} />
                  <Text className="font-bold text-base text-muted">Start Match</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
