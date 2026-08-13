import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

// A hand icon that waves a few times, pauses, then waves again — a small
// "hello" flourish for a greeting, not a constant distraction.
export default function WavingHandIcon({
  size = 24,
  color = colors.warning,
}: {
  size?: number;
  color?: string;
}) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    const wave = withTiming(20, { duration: 180, easing: Easing.inOut(Easing.quad) });
    rotate.value = withRepeat(
      withSequence(
        wave,
        withTiming(-14, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(18, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withDelay(2800, withTiming(0, { duration: 1 }))
      ),
      -1
    );
  }, [rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="hand-right" size={size} color={color} />
    </Animated.View>
  );
}
