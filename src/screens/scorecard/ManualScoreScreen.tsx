import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { PillRow } from "../../components/GameFormControls";
import FieldInput from "../../components/FieldInput";
import GradientFill from "../../components/GradientFill";
import { useEnterManualScore } from "../../hooks/useTournamentMatches";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { computeManualResult, isValidOversText, oversToDecimal, type ManualInnings, type ManualScore } from "../../lib/manualScore";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";

type Nav = NativeStackNavigationProp<GamesStackParamList, "ManualScore">;
type Route = RouteProp<GamesStackParamList, "ManualScore">;

const OVERS_PRESETS = ["2", "5", "10", "20", "50"];

function IconBadge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="items-center justify-center rounded-xl" style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}>
      <Ionicons name={icon} size={17} color={colors.primaryDark} />
    </View>
  );
}

function CardSection({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
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

function InfoBox({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  const isError = tone === "error";
  return (
    <View className="flex-row rounded-xl px-3 py-2.5 mt-3" style={{ backgroundColor: isError ? "#FEE2E2" : colors.primaryLight, gap: 8 }}>
      <Ionicons name="information-circle" size={16} color={isError ? colors.danger : colors.primaryDark} style={{ marginTop: 1 }} />
      <Text className="text-xs flex-1" style={{ color: isError ? colors.danger : colors.primaryDark }}>
        {text}
      </Text>
    </View>
  );
}

const digits = (t: string, max = 3) => t.replace(/[^0-9]/g, "").slice(0, max);

// A pair of number fields, one per team, on a single row.
function ScorePair({
  label,
  teamAName,
  teamBName,
  a,
  b,
  onA,
  onB,
}: {
  label?: string;
  teamAName: string;
  teamBName: string;
  a: string;
  b: string;
  onA: (v: string) => void;
  onB: (v: string) => void;
}) {
  return (
    <View className="mt-2">
      {label ? <Text className="text-ink font-semibold text-sm mb-2">{label}</Text> : null}
      <View className="flex-row" style={{ gap: 10 }}>
        <View className="flex-1">
          <Text className="text-muted text-xs mb-1" numberOfLines={1}>{teamAName}</Text>
          <FieldInput value={a} onChangeText={(t) => onA(digits(t))} placeholder="0" keyboardType="number-pad" maxLength={3} />
        </View>
        <View className="flex-1">
          <Text className="text-muted text-xs mb-1" numberOfLines={1}>{teamBName}</Text>
          <FieldInput value={b} onChangeText={(t) => onB(digits(t))} placeholder="0" keyboardType="number-pad" maxLength={3} />
        </View>
      </View>
    </View>
  );
}

type Pair = { a: string; b: string };

// Adds/removes rows of a per-set / per-game score list.
function PairRows({
  noun,
  rows,
  max,
  teamAName,
  teamBName,
  onChange,
}: {
  noun: string;
  rows: Pair[];
  max: number;
  teamAName: string;
  teamBName: string;
  onChange: (rows: Pair[]) => void;
}) {
  return (
    <>
      {rows.map((row, i) => (
        <ScorePair
          key={i}
          label={`${noun} ${i + 1}`}
          teamAName={teamAName}
          teamBName={teamBName}
          a={row.a}
          b={row.b}
          onA={(v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, a: v } : r)))}
          onB={(v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, b: v } : r)))}
        />
      ))}
      <View className="flex-row mt-4" style={{ gap: 10 }}>
        {rows.length < max && (
          <Pressable onPress={() => onChange([...rows, { a: "", b: "" }])} className="flex-row items-center rounded-xl px-3 py-2 border border-primary" style={{ gap: 6 }}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text className="text-primary text-sm font-semibold">Add {noun}</Text>
          </Pressable>
        )}
        {rows.length > 1 && (
          <Pressable onPress={() => onChange(rows.slice(0, -1))} className="flex-row items-center rounded-xl px-3 py-2 border border-border" style={{ gap: 6 }}>
            <Ionicons name="remove" size={16} color={colors.muted} />
            <Text className="text-muted text-sm font-semibold">Remove last</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

const EMPTY_INNINGS = { runs: "", wickets: "", overs: "" };

export default function ManualScoreScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { sport, allowDraw, prefill } = params;
  const insets = useSafeAreaInsets();
  const enterScore = useEnterManualScore(prefill.gameId);

  const isRacquetSets = sport === "padel" || sport === "tennis";
  const isRacquetGames = sport === "badminton" || sport === "pickleball" || sport === "table_tennis";

  // cricket
  const [oversLimit, setOversLimit] = useState<string | null>("20");
  const [battedFirst, setBattedFirst] = useState<"A" | "B" | null>(null);
  const [innings1, setInnings1] = useState(EMPTY_INNINGS);
  const [innings2, setInnings2] = useState(EMPTY_INNINGS);
  // sets / games
  const [rows, setRows] = useState<Pair[]>([{ a: "", b: "" }]);
  // football
  const [goalsA, setGoalsA] = useState("");
  const [goalsB, setGoalsB] = useState("");
  const [penalties, setPenalties] = useState<"NO" | "YES">("NO");
  const [pensA, setPensA] = useState("");
  const [pensB, setPensB] = useState("");

  const teamAName = prefill.teamAName;
  const teamBName = prefill.teamBName;
  const num = (t: string) => parseInt(t, 10);

  // Builds the score being typed — null until every required field is valid.
  const buildScore = (): ManualScore | null => {
    if (sport === "cricket") {
      const limit = num(oversLimit ?? "");
      if (!limit || !battedFirst) return null;
      const toInnings = (team: "A" | "B", f: typeof EMPTY_INNINGS): ManualInnings | null => {
        if (f.runs === "" || f.wickets === "" || !isValidOversText(f.overs)) return null;
        if (num(f.wickets) > 10 || oversToDecimal(f.overs) > limit) return null;
        return { team, runs: num(f.runs), wickets: num(f.wickets), overs: f.overs };
      };
      const first = toInnings(battedFirst, innings1);
      const second = toInnings(battedFirst === "A" ? "B" : "A", innings2);
      return first && second ? { sport: "cricket", oversLimit: limit, innings: [first, second] } : null;
    }
    if (isRacquetSets || isRacquetGames) {
      const parsed: [number, number][] = [];
      for (const r of rows) {
        if (r.a === "" || r.b === "" || num(r.a) === num(r.b)) return null;
        parsed.push([num(r.a), num(r.b)]);
      }
      return isRacquetSets ? { sport, sets: parsed } : { sport: sport as "badminton" | "pickleball" | "table_tennis", games: parsed };
    }
    // football
    if (goalsA === "" || goalsB === "") return null;
    const a = num(goalsA);
    const b = num(goalsB);
    if (a === b && penalties === "YES") {
      if (pensA === "" || pensB === "" || num(pensA) === num(pensB)) return null;
      return { sport: "football", a, b, pensA: num(pensA), pensB: num(pensB) };
    }
    return { sport: "football", a, b };
  };

  const score = buildScore();
  const result = score ? computeManualResult(score) : null;
  const drawNotAllowed = !!result?.isDraw && !allowDraw;
  const tiedSets = !!result?.isDraw && (isRacquetSets || isRacquetGames);
  const isValid = !!score && !!result && !drawNotAllowed && !tiedSets;

  const handleSave = () => {
    if (!score || !result || !isValid) return;
    enterScore.mutate(
      { matchId: prefill.tournamentMatchId, result: { winner: result.winner, isDraw: result.isDraw, manualScore: score } },
      {
        onSuccess: () => navigation.goBack(),
        onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not save the score.")),
      }
    );
  };

  const noun = isRacquetSets ? "Set" : "Game";

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="px-4 flex-row items-center" style={{ paddingTop: insets.top + 16, paddingBottom: 16, gap: 6 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">Enter Score</Text>
          <Text className="text-muted text-sm mt-0.5">Record the final score</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 260 }} keyboardShouldPersistTaps="handled">
        {/* Team names, players and venue already come from the tournament
            match and can't be changed here — shown as plain read-only
            context instead of locked, grayed-out form fields, since
            there's nothing left for the host to actually fill in for them. */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={cardShadow}>
          <View className="flex-row items-center">
            <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>{teamAName}</Text>
            <Text className="text-muted text-xs font-bold mx-2">VS</Text>
            <Text className="text-ink font-bold text-base flex-1 text-right" numberOfLines={1}>{teamBName}</Text>
          </View>
          {(prefill.teamAPlayers.length > 0 || prefill.teamBPlayers.length > 0) && (
            <View className="flex-row mt-3" style={{ gap: 10 }}>
              <Text className="text-muted text-xs flex-1" numberOfLines={2}>
                {prefill.teamAPlayers.map((p) => p.name).join(", ")}
              </Text>
              <Text className="text-muted text-xs flex-1 text-right" numberOfLines={2}>
                {prefill.teamBPlayers.map((p) => p.name).join(", ")}
              </Text>
            </View>
          )}
          {prefill.venue ? (
            <View className="flex-row items-center mt-3 pt-3" style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Ionicons name="location-outline" size={14} color={colors.muted} />
              <Text className="text-muted text-xs flex-1" numberOfLines={1}>{prefill.venue}</Text>
            </View>
          ) : null}
        </View>

        {sport === "cricket" && (
          <>
            <CardSection icon="baseball-outline" title="Overs per Innings">
              <PillRow
                options={OVERS_PRESETS.map((n) => ({ label: n, value: n }))}
                value={OVERS_PRESETS.includes(oversLimit ?? "") ? oversLimit : null}
                onChange={setOversLimit}
              />
              <Text className="text-muted text-xs mt-3 mb-2">Or enter a custom number</Text>
              <FieldInput value={oversLimit ?? ""} onChangeText={(t) => setOversLimit(digits(t))} placeholder="e.g. 15" keyboardType="number-pad" maxLength={3} />
            </CardSection>

            <CardSection icon="trophy-outline" title="Batted First">
              <PillRow
                options={[
                  { label: teamAName, value: "A" as const },
                  { label: teamBName, value: "B" as const },
                ]}
                value={battedFirst}
                onChange={setBattedFirst}
              />
            </CardSection>

            {battedFirst &&
              ([
                { key: 1, team: battedFirst, state: innings1, set: setInnings1 },
                { key: 2, team: battedFirst === "A" ? "B" : "A", state: innings2, set: setInnings2 },
              ] as const).map(({ key, team, state, set }) => (
                <CardSection key={key} icon="stats-chart-outline" title={`${team === "A" ? teamAName : teamBName} — ${key === 1 ? "1st" : "2nd"} Innings`}>
                  <View className="flex-row" style={{ gap: 10 }}>
                    <View className="flex-1">
                      <Text className="text-muted text-xs mb-1">Runs</Text>
                      <FieldInput value={state.runs} onChangeText={(t) => set({ ...state, runs: digits(t) })} placeholder="0" keyboardType="number-pad" maxLength={3} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-muted text-xs mb-1">Wickets</Text>
                      <FieldInput value={state.wickets} onChangeText={(t) => set({ ...state, wickets: digits(t, 2) })} placeholder="0" keyboardType="number-pad" maxLength={2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-muted text-xs mb-1">Overs</Text>
                      <FieldInput value={state.overs} onChangeText={(t) => set({ ...state, overs: t.replace(/[^0-9.]/g, "").slice(0, 5) })} placeholder="e.g. 18.3" keyboardType="decimal-pad" maxLength={5} />
                    </View>
                  </View>
                  {state.overs !== "" && !isValidOversText(state.overs) ? (
                    <InfoBox tone="error" text="Overs must look like 18 or 18.3 (0–5 balls after the dot)." />
                  ) : null}
                </CardSection>
              ))}
          </>
        )}

        {(isRacquetSets || isRacquetGames) && (
          <CardSection icon="trophy-outline" title={isRacquetSets ? "Set Scores" : "Game Scores"}>
            <PairRows noun={noun} rows={rows} max={isRacquetSets ? 5 : 7} teamAName={teamAName} teamBName={teamBName} onChange={setRows} />
            {tiedSets ? <InfoBox tone="error" text={`Each ${noun.toLowerCase()} needs a winner, and both teams can't win the same number of ${noun.toLowerCase()}s.`} /> : null}
          </CardSection>
        )}

        {sport === "football" && (
          <>
            <CardSection icon="football-outline" title="Final Score">
              <ScorePair teamAName={teamAName} teamBName={teamBName} a={goalsA} b={goalsB} onA={setGoalsA} onB={setGoalsB} />
            </CardSection>
            {goalsA !== "" && goalsA === goalsB && (
              <CardSection icon="flag-outline" title="Decided on Penalties?">
                <PillRow
                  options={[
                    { label: "No", value: "NO" as const },
                    { label: "Yes", value: "YES" as const },
                  ]}
                  value={penalties}
                  onChange={setPenalties}
                />
                {penalties === "YES" && <ScorePair label="Penalty shootout" teamAName={teamAName} teamBName={teamBName} a={pensA} b={pensB} onA={setPensA} onB={setPensB} />}
              </CardSection>
            )}
          </>
        )}

        {drawNotAllowed ? <InfoBox tone="error" text="A draw isn't allowed for this match — it needs a winner." /> : null}
        {isValid && result && (
          <InfoBox text={result.isDraw ? "Result: Draw" : `Result: ${result.winner === "A" ? teamAName : teamBName} won`} />
        )}

        <Pressable
          onPress={handleSave}
          disabled={!isValid || enterScore.isPending}
          style={isValid ? primaryButtonShadow : undefined}
        >
          {isValid ? (
            <GradientFill className="flex-row items-center justify-center rounded-2xl py-4 mt-4" style={{ gap: 8 }}>
              {enterScore.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="white" />
                  <Text className="font-bold text-base text-white">Save Score</Text>
                </>
              )}
            </GradientFill>
          ) : (
            <View className="flex-row items-center justify-center rounded-2xl py-4 mt-4 bg-gray-200" style={{ gap: 8 }}>
              {enterScore.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color={colors.muted} />
                  <Text className="font-bold text-base text-muted">Save Score</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
