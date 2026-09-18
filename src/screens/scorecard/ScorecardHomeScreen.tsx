import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "ScorecardHome">;

function SportCard({
  icon,
  iconColor,
  bgColor,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  bgColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
    >
      <View className="rounded-3xl bg-white p-5 flex-row items-center" style={{ gap: 16 }}>
        <View
          className="items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, backgroundColor: bgColor }}
        >
          <MaterialCommunityIcons name={icon} size={34} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-lg">{title}</Text>
          <Text className="text-muted text-sm mt-0.5">{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </Bouncy>
  );
}

export default function ScorecardHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-gray-100" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-5 mb-6">
        <Text className="text-2xl font-bold text-ink">Scorecard</Text>
        <Text className="text-muted text-sm mt-0.5">Choose a sport to start or view a match</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
        <SportCard
          icon="cricket"
          iconColor="#166534"
          bgColor="#DCFCE7"
          title="Cricket"
          subtitle="Ball-by-ball scoring with full innings & wickets"
          onPress={() => navigation.navigate("CricketHome")}
        />
        <SportCard
          icon="tennis"
          iconColor="#1D4ED8"
          bgColor="#DBEAFE"
          title="Padel"
          subtitle="Points, games & sets — FIP scoring rules"
          onPress={() => navigation.navigate("PadelHome")}
        />
        <SportCard
          icon="tennis-ball"
          iconColor="#B45309"
          bgColor="#FEF3C7"
          title="Tennis"
          subtitle="Points, games & sets with game/break/set/match point"
          onPress={() => navigation.navigate("TennisHome")}
        />
        <SportCard
          icon="racquetball"
          iconColor="#6D28D9"
          bgColor="#EDE9FE"
          title="Pickleball"
          subtitle="Side-out or rally scoring, singles & doubles"
          onPress={() => navigation.navigate("PickleballHome")}
        />
        <SportCard
          icon="badminton"
          iconColor="#BE185D"
          bgColor="#FCE7F3"
          title="Badminton"
          subtitle="Rally scoring to 21, with the 29-29 golden point rule"
          onPress={() => navigation.navigate("BadmintonHome")}
        />
        <SportCard
          icon="table-tennis"
          iconColor="#C2410C"
          bgColor="#FFEDD5"
          title="Table Tennis"
          subtitle="Rally scoring to 11, with ITTF service rotation"
          onPress={() => navigation.navigate("TableTennisHome")}
        />
        <SportCard
          icon="soccer"
          iconColor="#0F766E"
          bgColor="#CCFBF1"
          title="Football"
          subtitle="Live match clock, halves, extra time & penalties"
          onPress={() => navigation.navigate("FootballHome")}
        />
      </ScrollView>
    </View>
  );
}
