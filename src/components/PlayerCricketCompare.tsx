import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { searchUsers, type UserSearchResult } from "../lib/api/users";
import { aggregateBatting, aggregateBowling, aggregateFielding } from "../lib/playerCricketStats";
import { usePlayerCricketFigures } from "./PlayerCricketOverview";

function CompareBar({ label, leftValue, rightValue, leftLabel, rightDisplay, leftDisplay }: { label: string; leftValue: number; rightValue: number; leftLabel?: string; rightDisplay: string; leftDisplay: string }) {
  const max = Math.max(leftValue, rightValue, 1);
  const leftFraction = leftValue / max;
  const rightFraction = rightValue / max;
  return (
    <View className="flex-row items-center py-2" style={{ gap: 8 }}>
      <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
        <View className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#142533", flexDirection: "row-reverse" }}>
          <View style={{ width: `${leftFraction * 100}%`, height: "100%", backgroundColor: "#3B82F6", borderRadius: 999 }} />
        </View>
        <View className="rounded-lg border px-2 py-1" style={{ borderColor: colors.border, minWidth: 36 }}>
          <Text className="text-ink text-xs font-bold text-center">{leftDisplay}</Text>
        </View>
      </View>
      <Text className="text-ink text-xs font-semibold text-center" style={{ width: 70 }} numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
        <View className="rounded-lg border px-2 py-1" style={{ borderColor: colors.border, minWidth: 36 }}>
          <Text className="text-ink text-xs font-bold text-center">{rightDisplay}</Text>
        </View>
        <View className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#142533" }}>
          <View style={{ width: `${rightFraction * 100}%`, height: "100%", backgroundColor: "#3B82F6", borderRadius: 999 }} />
        </View>
      </View>
    </View>
  );
}

function PlayerSearch({ onSelect }: { onSelect: (u: UserSearchResult) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (t: string) => {
    setTerm(t);
    if (t.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await searchUsers(t);
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center rounded-full px-4 py-2.5" style={{ backgroundColor: "#142533", gap: 8 }}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={term}
          onChangeText={runSearch}
          placeholder="Search a player to compare"
          placeholderTextColor={colors.muted}
          className="flex-1 text-ink text-sm"
        />
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      {results.length > 0 ? (
        <View className="bg-surface rounded-2xl mt-2" style={cardShadow}>
          {results.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => {
                onSelect(u);
                setTerm("");
                setResults([]);
              }}
              className="flex-row items-center px-4 py-3"
              style={{ gap: 10 }}
            >
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
              ) : (
                <GradientFill className="items-center justify-center rounded-full" style={{ width: 32, height: 32 }}>
                  <Text className="text-jazba-white text-xs font-bold">{(u.full_name ?? "?").charAt(0).toUpperCase()}</Text>
                </GradientFill>
              )}
              <Text className="text-ink text-sm font-semibold flex-1" numberOfLines={1}>{u.full_name ?? "Player"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ComparePanel({
  fullNameA,
  nameA,
  fullNameB,
  nameB,
  sportId,
}: {
  fullNameA: string;
  nameA: string;
  fullNameB: string;
  nameB: string;
  sportId?: string | null;
}) {
  const { data: figuresA, isLoading: loadingA } = usePlayerCricketFigures(fullNameA, sportId);
  const { data: figuresB, isLoading: loadingB } = usePlayerCricketFigures(fullNameB, sportId);

  if (loadingA || loadingB) return <ActivityIndicator color={colors.primary} className="mt-6" />;

  const batA = aggregateBatting(figuresA ?? []);
  const batB = aggregateBatting(figuresB ?? []);
  const bowlA = aggregateBowling(figuresA ?? []);
  const bowlB = aggregateBowling(figuresB ?? []);
  const fieldA = aggregateFielding(figuresA ?? []);
  const fieldB = aggregateFielding(figuresB ?? []);

  return (
    <View className="bg-surface rounded-2xl p-4 mt-4" style={cardShadow}>
      <View className="flex-row justify-between mb-3">
        <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>{nameA}</Text>
        <Text className="text-ink font-bold text-base flex-1 text-right" numberOfLines={1}>{nameB}</Text>
      </View>

      <Text className="text-ink font-extrabold text-center mt-2">Batting</Text>
      <CompareBar label="Matches" leftValue={batA.innings} rightValue={batB.innings} leftDisplay={String(batA.innings)} rightDisplay={String(batB.innings)} />
      <CompareBar label="Runs" leftValue={batA.runs} rightValue={batB.runs} leftDisplay={String(batA.runs)} rightDisplay={String(batB.runs)} />
      <CompareBar label="Avg" leftValue={batA.average} rightValue={batB.average} leftDisplay={batA.average.toFixed(1)} rightDisplay={batB.average.toFixed(1)} />
      <CompareBar label="SR" leftValue={batA.strikeRate} rightValue={batB.strikeRate} leftDisplay={batA.strikeRate.toFixed(1)} rightDisplay={batB.strikeRate.toFixed(1)} />
      <CompareBar label="6s" leftValue={batA.sixes} rightValue={batB.sixes} leftDisplay={String(batA.sixes)} rightDisplay={String(batB.sixes)} />
      <CompareBar label="4s" leftValue={batA.fours} rightValue={batB.fours} leftDisplay={String(batA.fours)} rightDisplay={String(batB.fours)} />

      <Text className="text-ink font-extrabold text-center mt-4">Bowling</Text>
      <CompareBar label="Matches" leftValue={bowlA.innings} rightValue={bowlB.innings} leftDisplay={String(bowlA.innings)} rightDisplay={String(bowlB.innings)} />
      <CompareBar label="Wickets" leftValue={bowlA.wickets} rightValue={bowlB.wickets} leftDisplay={String(bowlA.wickets)} rightDisplay={String(bowlB.wickets)} />
      <CompareBar label="Avg" leftValue={bowlA.average} rightValue={bowlB.average} leftDisplay={bowlA.average.toFixed(1)} rightDisplay={bowlB.average.toFixed(1)} />
      <CompareBar label="Econ" leftValue={bowlA.economy} rightValue={bowlB.economy} leftDisplay={bowlA.economy.toFixed(1)} rightDisplay={bowlB.economy.toFixed(1)} />

      <Text className="text-ink font-extrabold text-center mt-4">Fielding</Text>
      <CompareBar label="Catches" leftValue={fieldA.catches} rightValue={fieldB.catches} leftDisplay={String(fieldA.catches)} rightDisplay={String(fieldB.catches)} />
      <CompareBar label="Runouts" leftValue={fieldA.runouts} rightValue={fieldB.runouts} leftDisplay={String(fieldA.runouts)} rightDisplay={String(fieldB.runouts)} />
    </View>
  );
}

export default function PlayerCricketCompare({
  fullName,
  displayName,
  sportId,
}: {
  fullName: string;
  displayName: string;
  sportId?: string | null;
}) {
  const [opponent, setOpponent] = useState<UserSearchResult | null>(null);

  return (
    <View>
      <PlayerSearch onSelect={setOpponent} />
      {opponent?.full_name ? (
        <ComparePanel
          fullNameA={fullName}
          nameA={displayName}
          fullNameB={opponent.full_name}
          nameB={opponent.full_name}
          sportId={sportId}
        />
      ) : null}
    </View>
  );
}
