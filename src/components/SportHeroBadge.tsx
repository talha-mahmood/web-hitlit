import { useEffect } from "react";

import Image from "./images/OptimizedImage";
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
import { getSportImage } from "../lib/sportImages";

// Pops in with a bounce and then bobs gently in place — replays every time
// `sportName` changes, so picking any sport (badminton, football, cricket…)
// gets the same lively confirmation, just with that sport's own icon.
export default function SportHeroBadge({ sportName }: { sportName: string }) {
  const scale = useSharedValue(0);
  const bob = useSharedValue(0);
  const photo = getSportImage(sportName);
  const { icon, bg, fg } = getSportIcon(sportName);

  useEffect(() => {
    scale.value = 0;
    scale.value = withSequence(
      withTiming(1.15, { duration: 260, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 150 })
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [sportName, scale, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: bob.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: fg,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {photo ? (
        <Image source={photo} style={{ width: 60, height: 60 }} resizeMode="cover" />
      ) : (
        <MaterialCommunityIcons name={icon} size={28} color={fg} />
      )}
    </Animated.View>
  );
}
