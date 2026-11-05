import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { cardShadow } from "../constants/theme";

// A single pulsing gray block — the building piece every shaped skeleton
// below is made of. Shown in place of real content while a screen's first
// load is still in flight, instead of a bare ActivityIndicator, so the
// screen's layout appears immediately and just "fills in" once data lands.
export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.45, { duration: 700 })),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#1C2D3A" }, animatedStyle, style]}
    />
  );
}

// A generic white rounded-2xl card with a thumbnail + a couple of text
// lines — the shape most list cards in this app share (games, venues,
// squads, players). `rows` renders this stacked `count` times with gaps,
// matching how a real list looks while it's still loading.
export function SkeletonCard() {
  return (
    <View className="bg-surface rounded-2xl p-3 flex-row" style={{ ...cardShadow, gap: 12 }}>
      <SkeletonBlock width={72} height={72} borderRadius={12} />
      <View className="flex-1 justify-center" style={{ gap: 8 }}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="45%" height={12} />
        <SkeletonBlock width="55%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonCardRows({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

// A detail screen's header block — a big image/banner plus a title and a
// couple of meta lines underneath, the shape every *DetailScreen shares.
export function SkeletonDetailHeader() {
  return (
    <View style={{ gap: 14 }}>
      <SkeletonBlock width="100%" height={180} borderRadius={20} />
      <SkeletonBlock width="60%" height={20} />
      <SkeletonBlock width="40%" height={14} />
      <View className="flex-row" style={{ gap: 8 }}>
        <SkeletonBlock width={90} height={28} borderRadius={14} />
        <SkeletonBlock width={90} height={28} borderRadius={14} />
      </View>
    </View>
  );
}
