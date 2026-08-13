import { useEffect } from "react";
import type { ComponentProps } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type DecorItem = {
  icon: IconName;
  top: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  size: number;
  duration: number;
  delay: number;
};

// A handful of faint sport icons slowly drifting/rotating in place — purely
// decorative texture behind the form, not interactive (pointerEvents=none).
const ICONS: DecorItem[] = [
  { icon: "soccer", top: "4%", left: "6%", size: 46, duration: 4200, delay: 0 },
  { icon: "basketball", top: "10%", right: "8%", size: 40, duration: 3600, delay: 300 },
  { icon: "tennis", top: "30%", left: "2%", size: 36, duration: 5000, delay: 600 },
  { icon: "badminton", top: "46%", right: "4%", size: 44, duration: 4600, delay: 200 },
  { icon: "volleyball", top: "62%", left: "8%", size: 38, duration: 3900, delay: 500 },
  { icon: "cricket", top: "76%", right: "10%", size: 42, duration: 4300, delay: 100 },
  { icon: "table-tennis", top: "90%", left: "14%", size: 34, duration: 3700, delay: 400 },
];

function FloatingIcon({ item }: { item: DecorItem }) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      item.delay,
      withRepeat(
        withSequence(
          withTiming(-14, { duration: item.duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: item.duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    rotate.value = withDelay(
      item.delay,
      withRepeat(
        withSequence(
          withTiming(8, { duration: item.duration * 1.3, easing: Easing.inOut(Easing.sin) }),
          withTiming(-8, { duration: item.duration * 1.3, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, [item.delay, item.duration, rotate, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        { position: "absolute", top: item.top, left: item.left, right: item.right },
        style,
      ]}
    >
      <MaterialCommunityIcons name={item.icon} size={item.size} color="rgba(255,255,255,0.16)" />
    </Animated.View>
  );
}

export default function SportsBackgroundDecor() {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {ICONS.map((item, i) => (
        <FloatingIcon key={i} item={item} />
      ))}
    </View>
  );
}
