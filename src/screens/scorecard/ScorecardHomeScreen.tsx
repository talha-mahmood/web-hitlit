import { View, Text, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "ScorecardHome">;

// Same sport photos/icons used for the "Filter by Sport" tiles on the home
// screen (see getSportImage/getSportIcon + HomeSportTile) — reused here
// instead of a separate flat-color glyph per card, so a sport looks the
// same wherever it appears in the app.
function SportCard({
  sportName,
  title,
  subtitle,
  onPress,
}: {
  sportName: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const photo = getSportImage(sportName);
  const { icon, bg, fg } = getSportIcon(sportName);
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 24 }}
    >
      <View className="rounded-3xl bg-white p-5 flex-row items-center" style={{ gap: 16 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-2xl"
          style={{ width: 64, height: 64, backgroundColor: photo ? colors.border : bg }}
        >
          {photo ? (
            <Image source={photo} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name={icon} size={34} color={fg} />
          )}
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
          sportName="cricket"
          title="Cricket"
          subtitle="Ball-by-ball scoring with full innings & wickets"
          onPress={() => navigation.navigate("CricketHome")}
        />
        <SportCard
          sportName="padel"
          title="Padel"
          subtitle="Points, games & sets — FIP scoring rules"
          onPress={() => navigation.navigate("PadelHome")}
        />
        <SportCard
          sportName="football"
          title="Football"
          subtitle="Live match clock, halves, extra time & penalties"
          onPress={() => navigation.navigate("FootballHome")}
        />
        <SportCard
          sportName="badminton"
          title="Badminton"
          subtitle="Rally scoring to 21, with the 29-29 golden point rule"
          onPress={() => navigation.navigate("BadmintonHome")}
        />
        <SportCard
          sportName="pickleball"
          title="Pickleball"
          subtitle="Side-out or rally scoring, singles & doubles"
          onPress={() => navigation.navigate("PickleballHome")}
        />
        <SportCard
          sportName="tennis"
          title="Tennis"
          subtitle="Points, games & sets with game/break/set/match point"
          onPress={() => navigation.navigate("TennisHome")}
        />
        <SportCard
          sportName="table tennis"
          title="Table Tennis"
          subtitle="Rally scoring to 11, with ITTF service rotation"
          onPress={() => navigation.navigate("TableTennisHome")}
        />
      </ScrollView>
    </View>
  );
}
