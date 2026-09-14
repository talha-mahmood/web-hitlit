import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { HomeStackParamList } from "../../navigation/HomeStackNavigator";
import PlayersDashboardContent from "./PlayersDashboardContent";

type Nav = NativeStackNavigationProp<HomeStackParamList, "PlayersDashboard">;

export default function PlayersDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center px-4 pb-4 border-b border-border bg-white"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Bouncy onPress={() => navigation.goBack()} scaleTo={0.85} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Bouncy>
        <Text className="text-base font-bold text-ink flex-1">Players Dashboard</Text>
      </View>

      <PlayersDashboardContent
        onPressPlayer={(userId) => navigation.navigate("PlayerProfile", { userId })}
      />
    </View>
  );
}
