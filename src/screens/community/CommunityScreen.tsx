import { View, Text, Pressable, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityHome">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - GRID_GAP) / 2;

function FeatureCard({
  title,
  subtitle,
  icon,
  iconColor,
  iconBg,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}) {
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16, width: CARD_WIDTH }}
    >
      <View
        className="border border-border rounded-2xl bg-white items-center px-3 pt-4 pb-5"
        style={{ width: CARD_WIDTH, minHeight: 190 }}
      >
        <Text className="text-ink font-bold text-base text-center">{title}</Text>
        <Text className="text-muted text-xs text-center mt-1 mb-4" numberOfLines={2}>
          {subtitle}
        </Text>
        <View
          className="items-center justify-center"
          style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: iconBg }}
        >
          <MaterialCommunityIcons name={icon} size={42} color={iconColor} />
        </View>
      </View>
    </Bouncy>
  );
}

export default function CommunityScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-100">
      <View
        className="flex-row items-center bg-white px-4 pb-3 border-b border-border"
        style={{ paddingTop: insets.top + 12, gap: 8 }}
      >
        <Pressable
          className="flex-1 items-center py-2.5 rounded-xl bg-primary-light"
        >
          <Text className="text-primary font-bold text-sm">My Community</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("PlayersDashboard")}
          className="flex-1 items-center py-2.5 rounded-xl"
        >
          <Text className="text-muted font-semibold text-sm">Top Players</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 20, marginBottom: 20, overflow: "hidden" }}
        >
          <Text className="text-white font-extrabold text-2xl" style={{ fontStyle: "italic" }}>
            PlayOye Community
          </Text>
          <Text className="text-white text-sm mt-1.5" style={{ opacity: 0.9 }}>
            Create Join Explore Squads & Games!
          </Text>
          <View
            className="flex-row items-center"
            style={{ position: "absolute", right: 16, bottom: 14, gap: 6, opacity: 0.35 }}
          >
            <MaterialCommunityIcons name="soccer" size={30} color="white" />
            <MaterialCommunityIcons name="tennis" size={28} color="white" />
            <MaterialCommunityIcons name="cricket" size={30} color="white" />
          </View>
        </LinearGradient>

        <View className="flex-row flex-wrap justify-between" style={{ rowGap: GRID_GAP }}>
          <FeatureCard
            title="Host Game"
            subtitle="Create game & play with players"
            icon="whistle"
            iconColor="#2563EB"
            iconBg="#DBEAFE"
            onPress={() => navigation.navigate("CreateGame", undefined)}
          />
          <FeatureCard
            title="Explore Games"
            subtitle="View & join games around you"
            icon="soccer"
            iconColor="#16A34A"
            iconBg="#DCFCE7"
            onPress={() => navigation.navigate("GamesList", undefined)}
          />
          <FeatureCard
            title="Create Squad"
            subtitle="Create squad to chat with members"
            icon="account-group"
            iconColor="#EA580C"
            iconBg="#FFEDD5"
            onPress={() => navigation.navigate("CreateSquad")}
          />
          <FeatureCard
            title="Explore Squads"
            subtitle="Explore & join squads around you"
            icon="account-search"
            iconColor="#7C3AED"
            iconBg="#EDE9FE"
            onPress={() => navigation.navigate("SquadsList")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
