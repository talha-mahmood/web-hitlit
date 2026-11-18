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

// A hand icon that waves a few times, pauses, then waves again — a small
// "hello" flourish for a greeting, not a constant distraction. Uses the real
// 👋 emoji so it renders in full color, rather than a flat monochrome vector
// icon.
export default function WavingHandIcon({ size = 24 }: { size?: number }) {
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
    <Animated.Text style={[{ fontSize: size, lineHeight: size * 1.15 }, animatedStyle]}>👋</Animated.Text>
  );
}
