import { View, Text, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";
import { colors } from "../constants/theme";

type Sport = { id: string; name: string };

const ICON_BADGE_SIZE = 76;

function SportTile({ sport, onPress }: { sport: Sport; onPress: () => void }) {
  const { icon, bg, fg } = getSportIcon(sport.name);
  return (
    <Pressable onPress={onPress} className="items-center" style={{ width: 84 }}>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: ICON_BADGE_SIZE, height: ICON_BADGE_SIZE, backgroundColor: bg }}
      >
        <MaterialCommunityIcons name={icon} size={40} color={fg} />
      </View>
      <Text
        className="text-ink font-semibold text-xs text-center mt-2"
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
    <View
      className="bg-white rounded-3xl border mb-6"
      style={{
        borderColor: colors.border,
        paddingTop: 18,
        paddingBottom: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <Text
        className="text-ink font-extrabold text-sm px-5 mb-4"
        style={{ letterSpacing: 0.6 }}
      >
        GAMES BY SPORTS
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 20 }}
      >
        {sports.map((sport) => (
          <SportTile key={sport.id} sport={sport} onPress={() => onSelectSport(sport.id)} />
        ))}
      </ScrollView>
    </View>
  );
}
