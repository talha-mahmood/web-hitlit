import { useEffect } from "react";
import { View, type ActivityIndicatorProps } from "react-native";
import { cssInterop } from "nativewind";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

// RN docs: small has a height of 20, large has a height of 36.
const SIZE_MAP = { small: 20, large: 36 } as const;

// Drop-in replacement for React Native's built-in <ActivityIndicator /> —
// same prop surface (animating/color/size/hidesWhenStopped/style/className)
// — that renders a rotating "hourglass" spinner instead of the OS spinner.
// See activityIndicatorPolyfill.ts for how this becomes the app-wide
// default without touching any of the 200+ existing call sites.
function HourglassActivityIndicator({
  animating = true,
  color = colors.primary,
  size = "small",
  hidesWhenStopped = true,
  style,
  ...rest
}: ActivityIndicatorProps) {
  const px = typeof size === "number" ? size : SIZE_MAP[size] ?? SIZE_MAP.small;
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!animating) return;
    // Mirrors the reference CSS keyframes exactly: 0deg -> 900deg with an
    // accelerating curve, then 900deg -> 1800deg with a decelerating curve,
    // each over 0.6s (1.2s total). 1800deg = 5 full turns, so the loop back
    // to 0deg is seamless (no visible jump).
    rotate.value = withRepeat(
      withSequence(
        withTiming(900, { duration: 600, easing: Easing.bezier(0.55, 0.055, 0.675, 0.19) }),
        withTiming(1800, { duration: 600, easing: Easing.bezier(0.215, 0.61, 0.355, 1) })
      ),
      -1,
      false
    );
  }, [animating, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  if (!animating && hidesWhenStopped) return null;

  // Same box-model trick as the CSS: a zero-size box whose entire visible
  // area is its border, with only the top/bottom border segments colored
  // (left/right transparent) and borderRadius equal to the border width —
  // that combination renders as a rotating "hourglass" bowtie shape.
  const border = Math.max(2, Math.round(px * 0.4));

  return (
    <View
      style={[
        // `alignSelf: "center"` so this behaves like the native spinner did
        // in call sites that render it directly inside a plain (non
        // `items-center`) column container — otherwise the default
        // `alignItems: "stretch"` cross-axis behavior leaves a
        // fixed-width box sitting at the start (left) instead of centered.
        { width: px, height: px, alignItems: "center", justifyContent: "center", alignSelf: "center" },
        style,
      ]}
      {...rest}
    >
      <Animated.View
        style={[
          {
            width: 0,
            height: 0,
            borderRadius: border,
            borderWidth: border,
            borderTopColor: color as string,
            borderBottomColor: color as string,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
          },
          animating ? animatedStyle : null,
        ]}
      />
    </View>
  );
}

// Lets existing call sites' `className="mt-10"` etc. keep working exactly
// as they did on the real (NativeWind-patched) ActivityIndicator.
cssInterop(HourglassActivityIndicator, { className: "style" });

export default HourglassActivityIndicator;
