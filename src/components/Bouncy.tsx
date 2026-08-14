import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import { cssInterop } from "nativewind";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// NativeWind only auto-resolves `className` on its own pre-registered core
// components — a custom-wrapped Animated component needs to opt in
// explicitly, otherwise `className` would silently do nothing here.
cssInterop(AnimatedPressable, { className: "style" });

// A Pressable that springs down slightly on press and bounces back on
// release — used for tactile press feedback on cards/buttons. Uses
// react-native-reanimated (already installed and linked in this project),
// so no new native dependency/build is needed.
//
// A Post button here once rendered invisible (transparent bg, no error)
// while combining a `className` (bg-primary + layout) with an explicit
// `style` prop — the className-driven half silently didn't apply. Once a
// caller needs `style` for anything (colors, shadows, ...), skip
// `className` on that instance entirely and put layout (padding,
// borderRadius, ...) in the same `style` object instead. Plain
// layout-only `className`s with no accompanying `style` prop are fine.
export default function Bouncy({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.97,
  ...rest
}: PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
