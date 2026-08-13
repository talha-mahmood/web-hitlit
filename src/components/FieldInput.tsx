import type { ComponentProps, ReactNode } from "react";
import { TextInput } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

// Shared "appealing" text field: rounded, a soft border, and a green
// highlight (border + tint background) that animates smoothly on focus
// instead of snapping — used in place of a plain
// `<TextInput className="border border-border rounded-xl ...">` wherever a
// form or search box on this screen collects free text. `left`/`right` let
// a field carry an icon or a fixed prefix (e.g. "Rs") inside the same
// rounded container; `right` fades in/out (e.g. a search box's clear
// button) instead of popping in abruptly.
//
// The outer container is an Animated.View driven by a Reanimated shared
// value, so its styling is passed as a plain style object rather than
// `className` — NativeWind's class interop isn't guaranteed on a
// Reanimated-animated component (see Bouncy.tsx for the same caveat).
export default function FieldInput({
  containerStyle,
  left,
  right,
  multiline,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof TextInput> & {
  containerStyle?: object;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const focus = useSharedValue(0);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(focus.value, [0, 1], ["#FFFFFF", colors.primaryLight]),
  }));

  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          borderRadius: 16,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          alignItems: multiline ? "flex-start" : "center",
          paddingVertical: multiline ? 4 : 0,
        },
        animatedContainerStyle,
        containerStyle,
      ]}
    >
      {left}
      <TextInput
        {...props}
        multiline={multiline}
        onFocus={(e) => {
          focus.value = withTiming(1, { duration: 160 });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focus.value = withTiming(0, { duration: 160 });
          onBlur?.(e);
        }}
        placeholderTextColor={colors.muted}
        style={[{ paddingVertical: 12 }, props.style]}
        className={`flex-1 text-ink ${props.className ?? ""}`}
      />
      {!!right && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
          {right}
        </Animated.View>
      )}
    </Animated.View>
  );
}
