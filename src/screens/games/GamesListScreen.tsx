import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useGames } from "../../hooks/useGames";
import { useSports } from "../../hooks/useSports";
import SportChip from "../../components/SportChip";
import { colors } from "../../constants/theme";
import type { GamesStackParamList } from "../../navigation/GamesStackNavigator";
import type { GameListItem } from "../../lib/api/games";
import { useAuthStore } from "../../store/authStore";

type Nav = NativeStackNavigationProp<GamesStackParamList, "GamesList">;

const SKILL_COLORS: Record<string, { bg: string; text: string }> = {
  BEGINNER:     { bg: "bg-green-50",  text: "text-green-700"  },
  INTERMEDIATE: { bg: "bg-yellow-50", text: "text-yellow-700" },
  ADVANCED:     { bg: "bg-orange-50", text: "text-orange-700" },
  PRO:          { bg: "bg-red-50",    text: "text-red-600"    },
};

// start_time is a TIME column ('HH:MM:SS'), combine with game_date for display
function formatGameDateTime(dateStr: string, startTime: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [y, m, d] = dateStr.split("-").map(Number);
  const gameDate = new Date(y, m - 1, d);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let dayLabel: string;
  if (isSameDay(gameDate, today)) {
    dayLabel = "Today";
  } else if (isSameDay(gameDate, tomorrow)) {
    dayLabel = "Tomorrow";
  } else {
    dayLabel = gameDate.toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric" });
  }

  const timeStr = new Date(`${dateStr}T${startTime}+05:00`).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dayLabel} · ${timeStr}`;
}

function GameCard({ game, onPress, currentUserId }: {
  game: GameListItem;
  onPress: () => void;
  currentUserId?: string;
}) {
  const joined = game.game_players.filter((p) => p.status === "JOINED");
  const spotsLeft = game.max_players - joined.length;
  const isFull = game.status === "FULL" || spotsLeft <= 0;
  const isMyGame = game.creator_id === currentUserId;
  const skill = game.skill_level;
  const skillStyle = skill ? SKILL_COLORS[skill] : null;

  return (
    <Pressable
      onPress={onPress}
      className="border border-border rounded-2xl mb-3 overflow-hidden bg-white"
    >
      {/* Top accent bar keyed to sport */}
      <View className="bg-primary h-1" />
      <View className="px-4 pt-3 pb-4">
        {/* Row 1: Sport + skill + my-game badge */}
        <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
          <View className="bg-primary-light px-2 py-0.5 rounded-full">
            <Text className="text-primary text-xs font-semibold">
              {game.sports?.name ?? "Sport"}
            </Text>
          </View>
          {skillStyle && (
            <View className={`px-2 py-0.5 rounded-full ${skillStyle.bg}`}>
              <Text className={`text-xs font-medium ${skillStyle.text}`}>
                {skill === "BEGINNER" ? "Beginner" :
                 skill === "INTERMEDIATE" ? "Intermediate" :
                 skill === "ADVANCED" ? "Advanced" : "Pro"}
              </Text>
            </View>
          )}
          {isMyGame && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full">
              <Text className="text-blue-600 text-xs font-medium">My Game</Text>
            </View>
          )}
          <View className="flex-1" />
          {isFull ? (
            <View className="bg-red-50 px-2 py-0.5 rounded-full">
              <Text className="text-red-600 text-xs font-medium">Full</Text>
            </View>
          ) : (
            <View className="bg-green-50 px-2 py-0.5 rounded-full">
              <Text className="text-primary text-xs font-medium">{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</Text>
            </View>
          )}
        </View>

        {/* Row 2: Title */}
        <Text className="text-ink font-bold text-base mb-1" numberOfLines={1}>
          {game.title}
        </Text>

        {/* Row 3: Date/time + players */}
        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="calendar-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm">
              {formatGameDateTime(game.game_date, game.start_time)}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text className="text-muted text-sm">
              {joined.length}/{game.max_players}
            </Text>
          </View>
        </View>

        {/* Row 4: Creator + entry fee */}
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="person-circle-outline" size={14} color={colors.muted} />
            <Text className="text-muted text-sm" numberOfLines={1}>
              {game.profiles?.full_name ?? "Unknown"}
            </Text>
          </View>
          <Text className="text-ink font-semibold text-sm">
            {game.entry_fee > 0 ? `Rs ${game.entry_fee.toLocaleString()}` : "Free"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function GamesListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [selectedSportId, setSelectedSportId] = useState<string | undefined>();

  const { data: sports } = useSports();
  const { data: games, isLoading, isRefetching, refetch } = useGames(
    selectedSportId ? { sportId: selectedSportId } : {}
  );

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 16 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Text className="text-2xl font-bold text-ink">Games</Text>
        <Pressable
          onPress={() => navigation.navigate("CreateGame")}
          className="flex-row items-center bg-primary rounded-xl px-3 py-2"
          style={{ gap: 4 }}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text className="text-white font-semibold text-sm">Create</Text>
        </Pressable>
      </View>

      {/* Sport filter chips */}
      <View style={{ paddingVertical: 6 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sports ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => (
            <SportChip
              label={item.name}
              selected={selectedSportId === item.id}
              onPress={() =>
                setSelectedSportId((cur) => (cur === item.id ? undefined : item.id))
              }
            />
          )}
        />
      </View>

      {/* Games list */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-10" />
      ) : (
        <FlatList
          data={games ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, gap: 0 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="items-center mt-16" style={{ gap: 12 }}>
              <Ionicons name="tennisball-outline" size={48} color={colors.border} />
              <Text className="text-ink font-semibold text-base">No games yet</Text>
              <Text className="text-muted text-sm text-center px-8">
                Be the first to create a game and invite players to join!
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CreateGame")}
                className="bg-primary rounded-xl px-6 py-3 mt-2"
              >
                <Text className="text-white font-semibold">Create a Game</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <GameCard
              game={item}
              currentUserId={userId}
              onPress={() => navigation.navigate("GameDetail", { gameId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
