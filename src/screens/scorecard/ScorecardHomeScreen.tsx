import { useCallback } from "react";
import { View, Text, Image, ScrollView, Pressable, BackHandler } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import GradientFill from "../../components/GradientFill";
import { getSportImage } from "../../lib/sportImages";
import { getSportIcon } from "../../lib/sportIcons";
import type { ScorecardStackParamList } from "../../navigation/ScorecardStackNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";

type Nav = NativeStackNavigationProp<ScorecardStackParamList, "ScorecardHome">;

// One row per sport: a rounded-square light-green badge holding the sport's
// photo (same photos as everywhere else in the app — getSportImage), a bold
// title, and a plain chevron — matching the reference layout exactly.
function SportCard({
  sportName,
  title,
  onPress,
}: {
  sportName: string;
  title: string;
  onPress: () => void;
}) {
  const photo = getSportImage(sportName);
  const { icon, fg } = getSportIcon(sportName);

  return (
    <Bouncy onPress={onPress} scaleTo={0.97}>
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 22,
          borderWidth: 2,
          borderColor: "#BFE8D0",
        }}
      >
        <View className="flex-row items-center" style={{ padding: 7, gap: 10 }}>
          <View
            className="items-center justify-center overflow-hidden"
            style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "white", padding: 6 }}
          >
            {photo ? (
              <Image source={photo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name={icon} size={28} color={fg} />
            )}
          </View>
          <Text className="text-ink font-bold flex-1" style={{ fontSize: 15 }} numberOfLines={1}>
            {title}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink} />
        </View>
      </View>
    </Bouncy>
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
        <Rect x={10} y={6} width={32} height={20} rx={4} fill="#CBEEDA" stroke="#1D9254" strokeWidth={1} />
        <SvgText x={26} y={21} fontSize={12} fontWeight="bold" fill="#0E5C34" textAnchor="middle">
          0-0
        </SvgText>
        <Rect x={13} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        <Rect x={35} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        {/* Trophy */}
        <Path d="M14 42h24v6c0 8-5 12-12 12s-12-4-12-12z" fill="#9FDBB8" stroke="#1D9254" strokeWidth={1} />
        <Path d="M14 44c-6 0-8 3-6 7 1 2 4 3 7 3M38 44c6 0 8 3 6 7-1 2-4 3-7 3" fill="none" stroke="#1D9254" strokeWidth={1.5} />
        <Rect x={23} y={60} width={6} height={5} fill="#6FC694" />
        <Rect x={16} y={65} width={20} height={5} rx={2} fill="#6FC694" />
        <Circle cx={8} cy={66} r={4.5} fill="#CBEEDA" stroke="#1D9254" strokeWidth={1} />
      </Svg>
      <View>
        <Text
          style={{ fontSize: 13, lineHeight: 17, fontStyle: "italic", fontWeight: "700", color: "white" }}
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
    <View className="flex-1 bg-white">
      {isFocused ? <StatusBar style="light" /> : null}
      {/* Fixed dark-green banner — same treatment as the Community tab's header. */}
      <GradientFill
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
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
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View className="flex-1" style={{ paddingRight: 130 }}>
            <Text className="text-white font-bold" style={{ fontSize: 19 }} numberOfLines={1}>Scorecard</Text>
            <Text style={{ fontSize: 11, marginTop: 2, color: "white" }} numberOfLines={1}>
              Live score your game
            </Text>
          </View>
        </View>
      </GradientFill>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 14, gap: 10 }} style={{ marginTop: 0 }}>
        <SportCard sportName="cricket" title="Cricket" onPress={() => navigation.navigate("CricketHome")} />
        <SportCard sportName="padel" title="Padel" onPress={() => navigation.navigate("PadelHome")} />
        <SportCard sportName="football" title="Football" onPress={() => navigation.navigate("FootballHome")} />
        <SportCard sportName="badminton" title="Badminton" onPress={() => navigation.navigate("BadmintonHome")} />
        <SportCard sportName="pickleball" title="Pickleball" onPress={() => navigation.navigate("PickleballHome")} />
        <SportCard sportName="tennis" title="Tennis" onPress={() => navigation.navigate("TennisHome")} />
        <SportCard
          sportName="table tennis"
          title="Table Tennis"
          onPress={() => navigation.navigate("TableTennisHome")}
        />
      </ScrollView>
    </View>
  );
}
