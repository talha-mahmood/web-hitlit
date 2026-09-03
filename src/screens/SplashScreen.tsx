import { useEffect } from "react";
import { View, Text, ImageBackground } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

const BAR_WIDTH = 160;

export default function SplashScreen() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <ImageBackground
      source={require("../../assets/splash-background.png")}
      className="flex-1"
      resizeMode="cover"
    >
      <View className="flex-1 items-center justify-end" style={{ paddingBottom: 72 }}>
        <View
          style={{
            width: BAR_WIDTH,
            height: 4,
            borderRadius: 2,
            backgroundColor: "rgba(17, 24, 39, 0.12)",
            overflow: "hidden",
          }}
        >
          <Animated.View style={[{ height: "100%", borderRadius: 2, backgroundColor: colors.primary }, barStyle]} />
        </View>

        <Text className="mt-4 font-medium" style={{ color: colors.muted, fontSize: 13 }}>
          Loading
        </Text>
      </View>
    </ImageBackground>
  );
}
