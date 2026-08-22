import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../constants/theme";

const ICON_SIZE = 108;

export default function SplashScreen() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.primary }}>
      <Animated.Image
        source={require("../../assets/icon.png")}
        style={[
          {
            width: ICON_SIZE,
            height: ICON_SIZE,
            borderRadius: ICON_SIZE / 2,
          },
          spinStyle,
        ]}
      />
      <Text className="text-2xl font-extrabold text-white mt-6 tracking-wide">PlayOye</Text>
    </View>
  );
}
