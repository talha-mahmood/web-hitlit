import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import Image from "./images/OptimizedImage";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { searchUsers, type UserSearchResult } from "../lib/api/users";
import { aggregateGeneric, SPORT_CONFIGS, type GenericSport } from "../lib/genericSportStats";
import { usePlayerGenericFigures } from "./PlayerSportOverview";
import { SkeletonCardRows } from "./Skeleton";

function CompareBar({ label, leftValue, rightValue, leftDisplay, rightDisplay }: { label: string; leftValue: number; rightValue: number; leftDisplay: string; rightDisplay: string }) {
  const max = Math.max(leftValue, rightValue, 1);
  return (
    <View className="flex-row items-center py-2" style={{ gap: 8 }}>
      <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
        <View className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceOverlay, flexDirection: "row-reverse" }}>
          <View style={{ width: `${(leftValue / max) * 100}%`, height: "100%", backgroundColor: "#3B82F6", borderRadius: 999 }} />
        </View>
        <View className="rounded-lg border px-2 py-1" style={{ borderColor: colors.border, minWidth: 36 }}>
          <Text className="text-ink text-xs font-bold text-center">{leftDisplay}</Text>
        </View>
      </View>
      <Text className="text-ink text-xs font-semibold text-center" style={{ width: 70 }} numberOfLines={1}>{label}</Text>
      <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
        <View className="rounded-lg border px-2 py-1" style={{ borderColor: colors.border, minWidth: 36 }}>
          <Text className="text-ink text-xs font-bold text-center">{rightDisplay}</Text>
        </View>
        <View className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.surfaceOverlay }}>
          <View style={{ width: `${(rightValue / max) * 100}%`, height: "100%", backgroundColor: "#3B82F6", borderRadius: 999 }} />
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
      setResults(await searchUsers(t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center rounded-full px-4 py-2.5" style={{ backgroundColor: colors.surfaceOverlay, gap: 8 }}>
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

function ComparePanel({ sport, fullNameA, nameA, fullNameB, nameB }: { sport: GenericSport; fullNameA: string; nameA: string; fullNameB: string; nameB: string }) {
  const { data: figuresA, isLoading: loadingA } = usePlayerGenericFigures(sport, fullNameA);
  const { data: figuresB, isLoading: loadingB } = usePlayerGenericFigures(sport, fullNameB);
  const cfg = SPORT_CONFIGS[sport];

  if (loadingA || loadingB) return <View className="mt-4"><SkeletonCardRows count={3} /></View>;

  const a = aggregateGeneric(figuresA ?? []);
  const b = aggregateGeneric(figuresB ?? []);

  return (
    <View className="bg-surface rounded-2xl p-4 mt-4" style={cardShadow}>
      <View className="flex-row justify-between mb-3">
        <Text className="text-ink font-bold text-base flex-1" numberOfLines={1}>{nameA}</Text>
        <Text className="text-ink font-bold text-base flex-1 text-right" numberOfLines={1}>{nameB}</Text>
      </View>
      <CompareBar label="Matches" leftValue={a.matches} rightValue={b.matches} leftDisplay={String(a.matches)} rightDisplay={String(b.matches)} />
      <CompareBar label="Wins" leftValue={a.wins} rightValue={b.wins} leftDisplay={String(a.wins)} rightDisplay={String(b.wins)} />
      <CompareBar label="Losses" leftValue={a.losses} rightValue={b.losses} leftDisplay={String(a.losses)} rightDisplay={String(b.losses)} />
      {cfg.hasDraw ? (
        <CompareBar label="Draws" leftValue={a.draws} rightValue={b.draws} leftDisplay={String(a.draws)} rightDisplay={String(b.draws)} />
      ) : null}
      <CompareBar label="Win %" leftValue={a.winPercent} rightValue={b.winPercent} leftDisplay={`${a.winPercent.toFixed(0)}%`} rightDisplay={`${b.winPercent.toFixed(0)}%`} />
      {cfg.headline === "goals" ? (
        <CompareBar label="Goals" leftValue={a.goals} rightValue={b.goals} leftDisplay={String(a.goals)} rightDisplay={String(b.goals)} />
      ) : null}
    </View>
  );
}

export default function PlayerSportCompare({ sport, fullName, displayName }: { sport: GenericSport; fullName: string; displayName: string }) {
  const [opponent, setOpponent] = useState<UserSearchResult | null>(null);

  return (
    <View>
      <PlayerSearch onSelect={setOpponent} />
      {opponent?.full_name ? (
        <ComparePanel sport={sport} fullNameA={fullName} nameA={displayName} fullNameB={opponent.full_name} nameB={opponent.full_name} />
      ) : null}
    </View>
  );
}
