import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import type { ReactNode } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

const CYCLE_INTERVAL = 1000;
const SWIPE_DURATION = 220;

// Shared search box for list screens (Games, Squads, Venues, ...). Two things
// set it apart from a plain FieldInput:
//  - A visibly darker border (+ a soft shadow) so it doesn't blend into the
//    white page background the way a pale `colors.border` line does.
//  - When empty, its placeholder is `prefix` (static, e.g. "Search by ")
//    followed by one of `variants` (e.g. "game name" / "game ID") — only the
//    variant part swipes out/in every second, the prefix never moves. A
//    native TextInput placeholder can't be animated, so this is a fake
//    overlay shown only while the field is empty.
export default function SearchField({
  value,
  onChangeText,
  prefix,
  variants,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  containerStyle,
  icon = "search-outline",
  right,
}: {
  value: string;
  onChangeText: (t: string) => void;
  prefix: string;
  variants: string[];
  autoCapitalize?: ComponentProps<typeof TextInput>["autoCapitalize"];
  autoCorrect?: boolean;
  keyboardType?: ComponentProps<typeof TextInput>["keyboardType"];
  containerStyle?: object;
  icon?: ComponentProps<typeof Ionicons>["name"];
  // Extra content after the text/clear button (e.g. a chevron) — optional,
  // every existing caller keeps its plain trailing clear-button look.
  right?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (variants.length < 2) return;
    let cancelled = false;
    const id = setInterval(() => {
      opacity.value = withTiming(0, { duration: SWIPE_DURATION, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(-10, { duration: SWIPE_DURATION, easing: Easing.in(Easing.ease) });
      setTimeout(() => {
        if (cancelled) return;
        setIndex((i) => (i + 1) % variants.length);
        translateY.value = 10;
        opacity.value = withTiming(1, { duration: SWIPE_DURATION, easing: Easing.out(Easing.ease) });
        translateY.value = withTiming(0, { duration: SWIPE_DURATION, easing: Easing.out(Easing.ease) });
      }, SWIPE_DURATION);
    }, CYCLE_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [variants, opacity, translateY]);

  const placeholderStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      className="flex-row items-center rounded-2xl px-4"
      style={[
        {
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : "#CBD5E1",
          backgroundColor: focused ? colors.primaryLight : "white",
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        },
        containerStyle,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.muted} />
      <View className="flex-1 ml-2" style={{ justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          // With a single variant there's nothing to animate/swipe, so this
          // uses a real native placeholder instead of the overlay below — a
          // native TextInput positions its cursor correctly relative to its
          // own placeholder; the overlay is a separate Text drawn on top and
          // doesn't share the input's exact text metrics, which is what made
          // the cursor look like it was sitting on top of the first letter.
          placeholder={variants.length < 2 ? `${prefix}${variants[0] ?? ""}` : undefined}
          placeholderTextColor={colors.muted}
          className="text-ink text-sm"
          style={{ paddingVertical: 12 }}
        />
        {value.length === 0 && variants.length >= 2 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              flexDirection: "row",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 14 }} numberOfLines={1}>
              {prefix}
            </Text>
            <Animated.View style={placeholderStyle}>
              <Animated.Text style={{ color: colors.muted, fontSize: 14 }} numberOfLines={1}>
                {variants[index % variants.length]}
              </Animated.Text>
            </Animated.View>
          </View>
        )}
      </View>
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.border} />
        </Pressable>
      )}
      {right}
    </View>
  );
}
