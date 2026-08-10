import { useState } from "react";
import { View, Text, Pressable, ScrollView, type LayoutChangeEvent } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";

type Sport = { id: string; name: string };

const ICON_BADGE_SIZE = 52;
const ICON_SIZE = 26;
const GAP = 26;
const VISIBLE_TILES = 3;

function SportTile({ sport, width, onPress }: { sport: Sport; width: number; onPress: () => void }) {
  const { icon, bg, fg } = getSportIcon(sport.name);
  return (
    <Pressable onPress={onPress} className="items-center" style={{ width }}>
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
  // Tile width is derived from the measured container width so exactly
  // VISIBLE_TILES fit per row regardless of screen size — the rest scroll.
  const [containerWidth, setContainerWidth] = useState(0);
  const tileWidth = containerWidth > 0 ? (containerWidth - GAP * (VISIBLE_TILES - 1)) / VISIBLE_TILES : 90;

  const handleLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0 && measured !== containerWidth) setContainerWidth(measured);
  };

  if (sports.length === 0) return null;

  return (
    <View className="mb-6" onLayout={handleLayout}>
      <Text
        className="text-ink font-bold"
        style={{ fontSize: 10, letterSpacing: 0.3, marginBottom: 12 }}
      >
        GAMES BY SPORTS
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: GAP }}
      >
        {sports.map((sport) => (
          <SportTile
            key={sport.id}
            sport={sport}
            width={tileWidth}
            onPress={() => onSelectSport(sport.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
