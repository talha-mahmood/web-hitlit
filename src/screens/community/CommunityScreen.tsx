import { View, Text, Pressable, ScrollView, Dimensions, Image } from "react-native";
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

// Every card uses a provided illustration that already has its own title +
// subtitle baked into the image itself — no extra text/icon overlay needed.
function ImageCard({ source, onPress }: { source: number; onPress: () => void }) {
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 16, width: CARD_WIDTH }}
    >
      <Image
        source={source}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: 16 }}
        resizeMode="cover"
      />
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
        <Pressable
          onPress={() => navigation.navigate("CommunityChat")}
          className="flex-1 items-center py-2.5 rounded-xl"
        >
          <Text className="text-muted font-semibold text-sm">Community Chat</Text>
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
          <ImageCard
            source={require("../../../assets/community-icons/host-game.png")}
            onPress={() => navigation.navigate("CreateGame", undefined)}
          />
          <ImageCard
            source={require("../../../assets/community-icons/explore-games.png")}
            onPress={() => navigation.navigate("GamesList", undefined)}
          />
          <ImageCard
            source={require("../../../assets/community-icons/create-squad.png")}
            onPress={() => navigation.navigate("CreateSquad")}
          />
          <ImageCard
            source={require("../../../assets/community-icons/explore-games.png")}
            onPress={() => navigation.navigate("SquadsList")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
