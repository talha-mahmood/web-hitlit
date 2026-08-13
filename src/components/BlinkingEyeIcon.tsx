import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

// An eye icon that double-blinks (squashed vertically to fake a closing
// eyelid) then pauses several seconds before blinking again — a small,
// occasional flourish rather than a constant animation.
export default function BlinkingEyeIcon({
  size = 18,
  color = colors.muted,
}: {
  size?: number;
  color?: string;
}) {
  const scaleY = useSharedValue(1);

  useEffect(() => {
    const close = withTiming(0.1, { duration: 90 });
    const open = withTiming(1, { duration: 90 });
    scaleY.value = withRepeat(
      withSequence(close, open, withDelay(150, close), open, withDelay(3500, withTiming(1, { duration: 1 }))),
      -1
    );
  }, [scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="eye-outline" size={size} color={color} />
    </Animated.View>
  );
}
