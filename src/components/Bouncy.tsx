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
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
