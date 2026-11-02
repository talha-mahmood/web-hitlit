import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import GradientFill from "../../components/GradientFill";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import PlayersDashboardContent from "../players/PlayersDashboardContent";
import CommunityChatContent from "./CommunityChatContent";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityHome">;
type Segment = "community" | "players" | "chat";

// Same row card the Scorecard listing screen uses (ScorecardHomeScreen's
// SportCard): white card, 2px pale-green border, white icon badge on the
// left, bold single-line title, plain chevron on the right.
function FeatureCard({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  onPress: () => void;
}) {
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
            <MaterialCommunityIcons name={icon} size={28} color={colors.primary} />
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

function MyCommunityContent({
  navigation,
  onOpenPlayers,
  onOpenChat,
}: {
  navigation: Nav;
  onOpenPlayers: () => void;
  onOpenChat: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 14, gap: 10 }}>
      <FeatureCard icon="chat" title="Community Chat" onPress={onOpenChat} />
      <FeatureCard icon="account-search" title="Find Players" onPress={onOpenPlayers} />
      <FeatureCard
        icon="trophy"
        title="Host Game"
        onPress={() => navigation.navigate("CreateGame", undefined)}
      />
      <FeatureCard
        icon="calendar-search"
        title="Explore Games"
        onPress={() => navigation.navigate("GamesList", undefined)}
      />
      <FeatureCard
        icon="trophy-award"
        title="Host Tournament"
        onPress={() => navigation.navigate("CreateGame", { gameType: "TOURNAMENT" })}
      />
      <FeatureCard
        icon="podium-gold"
        title="Explore Tournaments"
        onPress={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
      />
      <FeatureCard icon="account-group" title="Create Group" onPress={() => navigation.navigate("CreateSquad")} />
      <FeatureCard icon="account-group" title="Explore Groups" onPress={() => navigation.navigate("SquadsList")} />
      <FeatureCard icon="calendar-plus" title="Host Event" onPress={() => navigation.navigate("HostEvent")} />
      <FeatureCard icon="calendar-month" title="Explore Events" onPress={() => navigation.navigate("ExploreEvents")} />
    </ScrollView>
  );
}

export default function CommunityScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [segment, setSegment] = useState<Segment>("community");

  // The three segments live inside this one screen, so the tab-level
  // "pop the stack to its root" reset (MainTabNavigator) can't reach them.
  // Listen to the *tab's* blur (the parent navigator) — not this screen's own
  // blur, which would also fire when drilling into a player profile and
  // would reset Top Players out from under the user on the way back.
  useEffect(() => {
    return navigation.getParent()?.addListener("blur", () => setSegment("community"));
  }, [navigation]);

  // Community is a bottom-tab root — the phone's hardware/gesture back
  // button should take the user to the Home tab instead of exiting the app,
  // same as the header's own back arrow (only exits when already on Home).
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Inside Top Players / Community Chat, back returns to the cards first.
        if (segment !== "community") {
          setSegment("community");
          return true;
        }
        if (navigation.canGoBack()) return false;
        navigation.getParent()?.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation, segment])
  );

  return (
    <View className="flex-1 bg-white">
      {/* Fixed header — stays on screen while only the content below switches. */}
      {/* Dark-green header: icon tile + title/subtitle, rounded at the bottom; the tab bar overlaps its lower edge. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <GradientFill
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 14,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <Pressable
            onPress={() => {
              if (segment !== "community") {
                setSegment("community");
                return;
              }
              // Community is a bottom-tab root, so there's usually nothing to
              // pop to — fall back to the Home tab in that case.
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.getParent()?.navigate("Home");
            }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <GradientFill
            className="items-center justify-center"
            style={{ width: 54, height: 54, borderRadius: 16 }}
          >
            <MaterialCommunityIcons name="account-group" size={32} color="white" />
          </GradientFill>
          <View className="flex-1">
            <Text className="text-white font-extrabold" style={{ fontSize: 19 }}>
              {segment === "players" ? "Top Players" : segment === "chat" ? "Community Chat" : "Community"}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 16, color: "white", marginTop: 2 }}>
              Play Together, Stay Active
            </Text>
          </View>
        </View>
      </GradientFill>

      {segment === "community" && (
        <MyCommunityContent
          navigation={navigation}
          onOpenPlayers={() => setSegment("players")}
          onOpenChat={() => setSegment("chat")}
        />
      )}
      {/* Top Players / Community Chat sit under the header where the tab bar used to be. */}
      {segment !== "community" && (
      <View style={{ flex: 1, marginTop: 12 }}>
      {segment === "players" && (
        <PlayersDashboardContent
          onPressPlayer={(userId, sport) =>
            navigation.navigate("PlayerProfile", { userId, sportId: sport?.id, sportName: sport?.name })
          }
        />
      )}
      {segment === "chat" && (
        <CommunityChatContent
          onReply={(rootId) => navigation.navigate("CommentThread", { rootId })}
          onOpenProfile={(userId) => navigation.navigate("PlayerProfile", { userId })}
        />
      )}
      </View>
      )}
    </View>
  );
}
