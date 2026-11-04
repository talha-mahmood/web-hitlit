import { ScrollView, Pressable, Text } from "react-native";
import GradientFill from "./GradientFill";

export type SquadTeamTab = "detail" | "overview" | "players" | "matches" | "tournaments" | "statistics" | "compare";

const BASE_TABS: [SquadTeamTab, string][] = [
  ["detail", "Group Detail"],
  ["overview", "Team Overview"],
  ["players", "Players"],
  ["matches", "Matches"],
  ["tournaments", "Tournaments"],
];

// Same horizontal-pill tab bar PlayerProfileScreen.tsx already uses for its
// own per-player tabs — copied verbatim for consistency rather than
// reinventing a second tab-bar pattern.
export default function SquadTeamTabBar({
  value,
  onChange,
  showStatistics,
}: {
  value: SquadTeamTab;
  onChange: (v: SquadTeamTab) => void;
  // Statistics (Bat/Bowl/Field/MVP breakdowns) only exists for cricket teams
  // — there's no real per-player data to populate it with for any other sport.
  showStatistics: boolean;
}) {
  const tabs: [SquadTeamTab, string][] = [
    ...BASE_TABS,
    ...(showStatistics ? ([["statistics", "Statistics"]] as [SquadTeamTab, string][]) : []),
    ["compare", "Compare"],
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}
    >
      {tabs.map(([key, label]) =>
        value === key ? (
          <Pressable key={key} onPress={() => onChange(key)}>
            <GradientFill className="rounded-full px-4 py-2">
              <Text className="text-xs font-bold text-white">{label}</Text>
            </GradientFill>
          </Pressable>
        ) : (
          <Pressable key={key} onPress={() => onChange(key)} className="rounded-full px-4 py-2" style={{ backgroundColor: "#E5E7EB" }}>
            <Text className="text-xs font-bold" style={{ color: "#374151" }}>
              {label}
            </Text>
          </Pressable>
        )
      )}
    </ScrollView>
  );
}
