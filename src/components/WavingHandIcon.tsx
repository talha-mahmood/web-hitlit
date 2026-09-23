import { useEffect } from "react";
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
import { colors } from "../constants/theme";

// A hand icon that waves a few times, pauses, then waves again — a small
// "hello" flourish for a greeting, not a constant distraction. Uses the real
// 👋 emoji (full color, matches the reference) plus two small green motion
// strokes beside it, rather than a flat monochrome vector icon.
export default function WavingHandIcon({
  size = 24,
  color = colors.primary,
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
    <View style={{ width: size * 1.4, height: size * 1.2, alignItems: "center", justifyContent: "center" }}>
      <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.15 }, animatedStyle]}>👋</Animated.Text>
      <View
        style={{
          position: "absolute",
          top: size * 0.06,
          right: 0,
          width: size * 0.3,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: "-35deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: size * 0.34,
          right: -size * 0.08,
          width: size * 0.22,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: "-15deg" }],
        }}
      />
    </View>
  );
}
