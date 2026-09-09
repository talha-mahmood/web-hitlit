import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";
import { getSportImage } from "../lib/sportImages";

type Sport = { id: string; name: string };

const ICON_BADGE_SIZE = 52;
const ICON_SIZE = 26;
const GAP = 26;
const VISIBLE_TILES = 3;

function SportTile({
  sport,
  width,
  index,
  onPress,
}: {
  sport: Sport;
  width: number;
  index: number;
  onPress: () => void;
}) {
  const photo = getSportImage(sport.name);
  const { icon, bg, fg } = getSportIcon(sport.name);
  const scale = useSharedValue(1);

  // A slow, gentle idle pulse per icon badge, staggered by tile so the row
  // feels alive rather than all icons breathing in perfect unison.
  useEffect(() => {
    scale.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1,
        true
      )
    );
  }, [scale, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} className="items-center" style={{ width }}>
      <Animated.View
        style={[
          {
            width: ICON_BADGE_SIZE,
            height: ICON_BADGE_SIZE,
            borderRadius: ICON_BADGE_SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            overflow: "hidden",
          },
          animatedStyle,
        ]}
      >
        {photo ? (
          <Image
            source={photo}
            style={{ width: ICON_BADGE_SIZE, height: ICON_BADGE_SIZE }}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons name={icon} size={ICON_SIZE} color={fg} />
        )}
      </Animated.View>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: GAP }}
      >
        {sports.map((sport, index) => (
          <SportTile
            key={sport.id}
            sport={sport}
            width={tileWidth}
            index={index}
            onPress={() => onSelectSport(sport.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
