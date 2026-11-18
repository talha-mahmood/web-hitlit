import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

// A quick "pop" (scale up then settle back) that fires each time `selected`
// flips from false to true — a tactile confirmation that this option was
// just picked, not a continuous/ambient animation.
export function useSelectPulse(selected: boolean) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (selected) {
      scale.value = withSequence(
        withTiming(1.18, { duration: 120 }),
        withTiming(1, { duration: 140 })
      );
    }
  }, [selected, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}
