import { useEffect } from "react";
import type { ComponentProps } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getSportIcon } from "../lib/sportIcons";
import { colors } from "../constants/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

// A big, slowly-rotating/bobbing sport icon watermarked behind the top of a
// details screen — gives each game/tournament a bit of graphical identity
// (a badminton game gets a big racket+shuttle glyph, etc.) without needing
// per-sport illustration assets. Falls back to a generic team icon when
// there's no single sport to key off (squads aren't sport-specific).
function FloatingGlyph({
  icon,
  color,
  size,
  top,
  left,
  right,
  reverse,
  opacity = 0.1,
}: {
  icon: IconName;
  color: string;
  size: number;
  top: number;
  left?: number;
  right?: number;
  reverse?: boolean;
  opacity?: number;
}) {
  const rotate = useSharedValue(reverse ? 8 : -8);
  const translateY = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withSequence(
        withTiming(reverse ? -8 : 8, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
        withTiming(reverse ? 8 : -8, { duration: 5200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 4400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [icon, reverse, rotate, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: "absolute", top, left, right, opacity }, style]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Animated.View>
  );
}

export default function DetailSportBackdrop({ sportName }: { sportName?: string | null }) {
  const { icon, fg } = sportName ? getSportIcon(sportName) : { icon: "trophy" as IconName, fg: colors.primary };

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, overflow: "hidden" }}
      pointerEvents="none"
    >
      <FloatingGlyph icon={icon} color={fg} size={220} top={-36} right={-46} opacity={0.08} />
      <FloatingGlyph icon={icon} color={fg} size={100} top={210} left={-24} reverse opacity={0.12} />
    </View>
  );
}
