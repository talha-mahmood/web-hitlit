import { useCallback, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, BackHandler } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow, primaryButtonShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import GradientFill from "../../components/GradientFill";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "ScorecardHome">;

// Pastel disc behind each sport's photo (matches the design mock-up).
const SPORT_DISC: Record<string, string> = {
  cricket: "#DCF5E4",
  padel: "#FEF3D6",
  football: "#E0ECFB",
  badminton: "#DDF4E6",
  pickleball: "#EAE6F8",
  tennis: "#FCE8EA",
  "table tennis": "#DCE9FA",
};

// Same sport photos/icons used for the "Filter by Sport" tiles on the home
// screen (see getSportImage/getSportIcon + HomeSportTile), shown in a round
// pastel disc. The photos have a white backdrop, so they're multiplied onto the
// disc colour — the white turns into the pastel and the equipment keeps its
// colours.
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
  const disc = SPORT_DISC[sportName] ?? bg;
  // A card only turns green while it's being pressed.
  const [active, setActive] = useState(false);

  const body = (
    <View className="flex-row items-center" style={{ padding: 9, gap: 10 }}>
      <View
        className="items-center justify-center overflow-hidden rounded-full"
        style={{ width: 54, height: 54, backgroundColor: disc, padding: 9 }}
      >
        {photo ? (
          // Sized to exactly fill the (padded) disc — same approach the
          // Home screen's "Filter by Sport" tiles use — so the whole photo
          // scales down to fit instead of being cropped by the disc's
          // overflow:hidden like the old oversized fixed-size box was.
          <View style={{ width: "100%", height: "100%", mixBlendMode: "multiply" }}>
            <Image source={photo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </View>
        ) : (
          <MaterialCommunityIcons name={icon} size={26} color={fg} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-ink font-bold" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text className="text-muted mt-0.5" style={{ fontSize: 11.5, lineHeight: 15 }}>
          {subtitle}
        </Text>
      </View>
      {active ? (
        <GradientFill className="items-center justify-center rounded-full" style={{ width: 28, height: 28, ...primaryButtonShadow }}>
          <Ionicons name="chevron-forward" size={15} color="white" />
        </GradientFill>
      ) : (
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 27, height: 27, backgroundColor: colors.surfaceOverlay }}
        >
          <Ionicons name="chevron-forward" size={15} color={colors.muted} />
        </View>
      )}
    </View>
  );

  return (
    // Shadow + border live on a plain View (exactly PlayerStatCards.tsx's
    // own card container: backgroundColor white + ...cardShadow +
    // borderRadius), not on the Bouncy/AnimatedPressable itself — Bouncy
    // nests inside, carrying only the press-scale animation, so the card's
    // visible edge is guaranteed to render the same reliable way the
    // Profile section's cards do.
    <View
      style={{
        backgroundColor: colors.surface,
        ...cardShadow,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Bouncy
        onPress={onPress}
        onPressIn={() => setActive(true)}
        onPressOut={() => setActive(false)}
        scaleTo={0.97}
      >
        {active ? (
          <LinearGradient
            colors={["#D1F5DD", colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 22.5 }}
          >
            {body}
          </LinearGradient>
        ) : (
          <View className="rounded-3xl bg-surface">{body}</View>
        )}
      </Bouncy>
    </View>
  );
}

// Soft scoreboard-and-trophy mascot with the "Keep Score Keep Playing" tagline,
// sitting in the top-right of the header.
function HeaderArt() {
  return (
    <View pointerEvents="none" className="flex-row items-center" style={{ gap: 4 }}>
      <Svg width={52} height={72} viewBox="0 0 52 72">
        {/* Scoreboard */}
        <Rect x={6} y={2} width={40} height={28} rx={6} fill="#6FC694" />
        <Rect x={10} y={6} width={32} height={20} rx={4} fill="#CBEEDA" stroke="#18C66A" strokeWidth={1} />
        <SvgText x={26} y={21} fontSize={12} fontWeight="bold" fill={colors.primaryDark} textAnchor="middle">
          0-0
        </SvgText>
        <Rect x={13} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        <Rect x={35} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        {/* Trophy */}
        <Path d="M14 42h24v6c0 8-5 12-12 12s-12-4-12-12z" fill="#9FDBB8" stroke="#18C66A" strokeWidth={1} />
        <Path d="M14 44c-6 0-8 3-6 7 1 2 4 3 7 3M38 44c6 0 8 3 6 7-1 2-4 3-7 3" fill="none" stroke="#18C66A" strokeWidth={1.5} />
        <Rect x={23} y={60} width={6} height={5} fill="#6FC694" />
        <Rect x={16} y={65} width={20} height={5} rx={2} fill="#6FC694" />
        <Circle cx={8} cy={66} r={4.5} fill="#CBEEDA" stroke="#18C66A" strokeWidth={1} />
      </Svg>
      <View>
        <Text
          style={{ fontSize: 11, lineHeight: 14, fontStyle: "italic", fontWeight: "700", color: colors.muted }}
        >
          {"Keep\nScore\nKeep Playing"}
        </Text>
        <Svg width={70} height={8} viewBox="0 0 70 8">
          <Path d="M2 5c14-4 34-4 60-1" fill="none" stroke="#8FD9AE" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}

export default function ScorecardHomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // Scorecard is a bottom-tab root — the phone's hardware/gesture back
  // button should take the user to the Home tab instead of exiting the app.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (navigation.canGoBack()) return false;
        navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  return (
    <View className="flex-1 bg-app">
      {/* Compact dark header matching the Jazba screen chrome. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 14,
          backgroundColor: colors.background,
          position: "relative",
        }}
      >
        <View pointerEvents="none" style={{ position: "absolute", right: 12, top: insets.top + 12, bottom: 20, justifyContent: "center" }}>
          <HeaderArt />
        </View>

        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate("Home")}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View className="flex-1" style={{ paddingRight: 130 }}>
            <Text className="text-ink font-bold" style={{ fontSize: 19 }} numberOfLines={1}>Scorecard</Text>
            <Text className="text-muted" style={{ fontSize: 10.5, marginTop: 1 }} numberOfLines={1}>
              Live score your game
            </Text>
          </View>
        </View>
      </View>

      {/* gap stays just above cardShadow's own reach (offset 6 + radius 12
          ≈ 18px) — any tighter and a card's shadow gets painted over by the
          next card's opaque white background instead of actually being
          visible. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 14, gap: 15 }} style={{ marginTop: 0 }}>
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
          subtitle="11-point games, best of 5 or 7"
          onPress={() => navigation.navigate("TableTennisHome")}
        />
      </ScrollView>
    </View>
  );
}
