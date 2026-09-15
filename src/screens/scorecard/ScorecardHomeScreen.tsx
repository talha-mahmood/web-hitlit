import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import { useAuthStore } from "../../store/authStore";
import { useMyCricketMatches, useDeleteCricketMatch } from "../../hooks/useCricket";
import type { CricketMatch } from "../../lib/api/cricket";
import Bouncy from "../../components/Bouncy";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "ScorecardHome">;

function MatchCard({
  match,
  onPress,
  onDelete,
}: {
  match: CricketMatch;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isLive = match.status === "IN_PROGRESS";
  return (
    <Bouncy
      onPress={onPress}
      onLongPress={onDelete}
      scaleTo={0.98}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16 }}
      className="mb-3"
    >
      <View className="border border-border rounded-2xl bg-white p-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className={`px-2 py-0.5 rounded-full ${isLive ? "bg-red-50" : "bg-green-50"}`}>
            <Text className={`text-xs font-bold ${isLive ? "text-red-600" : "text-green-700"}`}>
              {isLive ? "● LIVE" : "COMPLETED"}
            </Text>
          </View>
          <Text className="text-muted text-xs">{match.overs_limit} overs</Text>
        </View>
        <Text className="text-ink font-bold text-base">
          {match.team_a_name} <Text className="text-muted font-normal">vs</Text> {match.team_b_name}
        </Text>
        {match.result_summary && (
          <Text className="text-primary text-sm font-semibold mt-1">{match.result_summary}</Text>
        )}
        <Text className="text-muted text-xs mt-2">
          {new Date(match.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
        </Text>
      </View>
    </Bouncy>
  );
}

export default function ScorecardHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: matches, isLoading } = useMyCricketMatches(userId);
  const deleteMatch = useDeleteCricketMatch();

  const handleDelete = (match: CricketMatch) => {
    Alert.alert(
      "Delete Match",
      `Delete the scorecard for ${match.team_a_name} vs ${match.team_b_name}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMatch.mutate(match.id, {
              onError: (err) => Alert.alert("Error", err instanceof Error ? err.message : "Could not delete match."),
            }),
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Text className="text-2xl font-bold text-ink">Scorecard</Text>
        <Pressable
          onPress={() => navigation.navigate("NewMatch")}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4, ...primaryButtonShadow }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">New Match</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={matches ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          ListEmptyComponent={
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <MaterialCommunityIcons name="cricket" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">No matches yet</Text>
              <Text className="text-muted text-sm text-center px-8">
                Start a new match and score it ball-by-ball, live.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              onPress={() =>
                item.status === "IN_PROGRESS"
                  ? navigation.navigate("LiveScoring", { matchId: item.id })
                  : navigation.navigate("FullScorecard", { matchId: item.id })
              }
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}
