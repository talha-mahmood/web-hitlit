import { useEffect } from "react";
import { View, Text, ImageBackground } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

const DOT_COUNT = 4;
const DOT_COLOR = "#6EE7B0";
const CYCLE_STAGGER = 180;
const PULSE_DURATION = 380;

function LoadingDot({ index }: { index: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    const restDelay = (DOT_COUNT - 1 - index) * CYCLE_STAGGER + 260;
    t.value = withDelay(
      index * CYCLE_STAGGER,
      withRepeat(
        withSequence(
          withTiming(1, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
          withDelay(restDelay, withTiming(0, { duration: 1 }))
        ),
        -1
      )
    );
  }, [t, index]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + t.value * 0.7,
    transform: [{ scale: 1 + t.value * 0.35 }],
  }));

  return (
    <Animated.View
      style={[
        { width: 12, height: 12, borderRadius: 6, backgroundColor: DOT_COLOR, marginHorizontal: 6 },
        style,
      ]}
    />
  );
}

export default function SplashScreen() {
  return (
    <ImageBackground
      source={require("../../assets/splash-background.png")}
      className="flex-1"
      resizeMode="cover"
    >
      <View className="flex-1 items-center justify-end" style={{ paddingBottom: 72 }}>
        <View className="flex-row items-center">
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <LoadingDot key={i} index={i} />
          ))}
        </View>

        <Text className="mt-4 font-medium" style={{ color: colors.muted, fontSize: 13 }}>
          Loading
        </Text>
      </View>
    </ImageBackground>
  );
}
