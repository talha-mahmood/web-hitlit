import { View, Text, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";

type Sport = { id: string; name: string };

const ICON_BADGE_SIZE = 52;
const ICON_SIZE = 26;

function SportTile({ sport, onPress }: { sport: Sport; onPress: () => void }) {
  const { icon, bg, fg } = getSportIcon(sport.name);
  return (
    <Pressable onPress={onPress} className="items-center" style={{ width: 60 }}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: ICON_BADGE_SIZE, height: ICON_BADGE_SIZE, backgroundColor: bg }}
      >
        <MaterialCommunityIcons name={icon} size={ICON_SIZE} color={fg} />
      </View>
      <Text
        className="text-ink font-semibold text-center mt-1.5"
        style={{ fontSize: 13 }}
        numberOfLines={1}
      >
        {sport.name}
      </Text>
    </Pressable>
  );
}

export default function SportsBySportSection({
  sports,
  onSelectSport,
}: {
  sports: Sport[];
  onSelectSport: (sportId: string) => void;
}) {
  if (sports.length === 0) return null;

  return (
    <View className="mb-6">
      <Text
        className="text-ink font-bold"
        style={{ fontSize: 10, letterSpacing: 0.3, marginBottom: 12 }}
      >
        GAMES BY SPORTS
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 26 }}
      >
        {sports.map((sport) => (
          <SportTile key={sport.id} sport={sport} onPress={() => onSelectSport(sport.id)} />
        ))}
      </ScrollView>
    </View>
  );
}
