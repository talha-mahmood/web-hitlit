import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, Dimensions, Image, BackHandler, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import GradientFill from "../../components/GradientFill";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import PlayersDashboardContent from "../players/PlayersDashboardContent";
import CommunityChatContent from "./CommunityChatContent";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityHome">;
type Segment = "community" | "players" | "chat";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDE_PADDING = 16;
// The cards run almost edge to edge: a slim margin on each side and a slim
// gap between the two columns, so each card is as wide as the screen allows.
// Wide enough to clear cardShadow's own reach (offset 6 + radius 12) on
// every side — any tighter and a card's shadow gets painted over by its
// neighbor (the next sibling's opaque white background fully covers
// whatever shadow bled into that gap) instead of actually being visible.
const GRID_SIDE_PADDING = 16;
const GRID_COL_GAP = 16;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_COL_GAP) / 2);
const CARD_TEXT_HEIGHT = 58;
// Every card uses a provided illustration that already has its own title +
// subtitle baked into the image itself — no extra text/icon overlay needed,
// except the Create Squad card, which gets a banner-image-then-title layout
// copied from VenueListCard (VenuesListScreen.tsx): a top image, then a
// padded title/subtitle block underneath.
function ImageCard({
  source,
  visual,
  onPress,
  title,
  description,
  width,
  height,
}: {
  width: number;
  // Height of the picture area (the title strip sits under it).
  height: number;
  source?: number;
  // A drawn visual (see HeroVisual) used instead of a picture.
  visual?: ReactNode;
  onPress: () => void;
  title: string;
  description: string;
}) {
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{
        backgroundColor: "white",
        ...cardShadow,
        width,
        borderRadius: 22,
      }}
    >
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 22,
          overflow: "hidden",
        }}
      >
        {/* IMAGE — stays the same size */}
        {visual ?? (
          <Image
            source={source}
            style={{
              width,
              height,
            }}
            resizeMode="contain"
          />
        )}

        {/* TEXT AREA — this is what gets bigger */}
        <View
          style={{
            height: CARD_TEXT_HEIGHT,
            paddingHorizontal: 10,
            paddingTop: 0,
            paddingBottom: 0,
            justifyContent: "center",
          }}
        >
          <Text
            className="text-ink font-extrabold"
            style={{
              fontSize: 15,
              lineHeight: 18,
              width: width - 20,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            className="text-muted"
            style={{
              fontSize: 10,
              lineHeight: 13,
              width: width - 20,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {description}
          </Text>
        </View>

        {/* Border drawn as its own translucent overlay, painted last so it
            sits on top of the image instead of being covered by it (the
            image is flush with the card's top edge). Opacity applies only
            to the border, not the image/text content underneath it. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: colors.border,
            opacity: 5.6,
          }}
        />
      </View>
    </Bouncy>
  );
}

// Drawn artwork for the two feature cards (Top Players / Community Chat) that
// have no bundled picture: a green gradient tile with soft circles and a big
// icon, sized like the pictures on the other four cards.
function HeroVisual({
  colorsFrom,
  icon,
  accentIcons,
  width,
  height,
}: {
  width: number;
  height: number;
  colorsFrom: [string, string];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentIcons: (keyof typeof MaterialCommunityIcons.glyphMap)[];
}) {
  const size = Math.min(width, height);
  return (
    <LinearGradient
      colors={colorsFrom}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width, height, alignItems: "center", justifyContent: "center" }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", width: size * 0.9, height: size * 0.9, borderRadius: size, backgroundColor: "white", opacity: 0.1, top: -size * 0.3, right: -size * 0.3 }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", width: size * 0.6, height: size * 0.6, borderRadius: size, backgroundColor: "white", opacity: 0.08, bottom: -size * 0.2, left: -size * 0.15 }}
      />
      <View
        className="items-center justify-center"
        style={{ width: size * 0.52, height: size * 0.52, borderRadius: size, backgroundColor: "rgba(255,255,255,0.2)" }}
      >
        <MaterialCommunityIcons name={icon} size={size * 0.3} color="white" />
      </View>
      <MaterialCommunityIcons name={accentIcons[0]} size={24} color="white" style={{ position: "absolute", top: 14, left: 14, opacity: 0.6 }} />
      <MaterialCommunityIcons name={accentIcons[1]} size={22} color="white" style={{ position: "absolute", bottom: 14, right: 14, opacity: 0.6 }} />
    </LinearGradient>
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
  // All ten cards (5 rows of 2) are sized to fit the space between the header
  // and the bottom tab bar when possible; the card is capped at its regular
  // width-based size on tall screens, and the ScrollView lets the grid scroll
  // instead of being squashed on short screens.
  const [areaHeight, setAreaHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setAreaHeight(e.nativeEvent.layout.height);
  const ROWS = 5;
  const TOP_PAD = 12;
  const BOTTOM_PAD = 12;
  // Tall enough to clear cardShadow's vertical reach (offset 6 + radius
  // 12 ≈ 18px) — otherwise the next row's card paints right over the
  // previous row's shadow instead of leaving it visible underneath.
  const ROW_GAP = 24;
  const fitted = areaHeight > 0
    ? (areaHeight - TOP_PAD - BOTTOM_PAD - ROW_GAP * (ROWS - 1) - CARD_TEXT_HEIGHT * ROWS) / ROWS
    : CARD_WIDTH;
  // Picture height fits the available space; the width is always the full
  // column width, so on short screens the cards are wider than they are tall.
  const imageHeight = Math.floor(Math.max(96, Math.min(CARD_WIDTH, fitted)));

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GRID_SIDE_PADDING, paddingTop: TOP_PAD, paddingBottom: BOTTOM_PAD }}>
        <View className="flex-row flex-wrap justify-between" style={{ rowGap: ROW_GAP }}>
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/community-chat.png")}
            onPress={onOpenChat}
            title="Community Chat"
            description="Chat with the community"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/Top-Players.png")}
            onPress={onOpenPlayers}
            title="Find Players"
            description="Discover players near you"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/host-game.png")}
            onPress={() => navigation.navigate("CreateGame", undefined)}
            title="Host Game"
            description="Start your own match"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/explore-games.png")}
            onPress={() => navigation.navigate("GamesList", undefined)}
            title="Explore Games"
            description="Join games near you"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/host-game.png")}
            onPress={() => navigation.navigate("CreateGame", { gameType: "TOURNAMENT" })}
            title="Host Tournament"
            description="Organize a tournament"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/explore-games.png")}
            onPress={() => navigation.navigate("GamesList", { gameType: "TOURNAMENT" })}
            title="Explore Tournaments"
            description="Browse live tournaments"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/create-squad.png")}
            onPress={() => navigation.navigate("CreateSquad")}
            title="Create Group"
            description="Build your own squad"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/explore-squad.png")}
            onPress={() => navigation.navigate("SquadsList")}
            title="Explore Groups"
            description="Find groups to join"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/create-squad.png")}
            onPress={() => navigation.navigate("HostEvent")}
            title="Host Event"
            description="Plan a community event"
          />
          <ImageCard
            width={CARD_WIDTH}
            height={imageHeight}
            source={require("../../../assets/community-icons/explore-squad.png")}
            onPress={() => navigation.navigate("ExploreEvents")}
            title="Explore Events"
            description="Discover upcoming events"
          />
        </View>
      </ScrollView>
    </View>
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
            <Text style={{ fontSize: 10.5, marginTop: 1, color: "white" }} numberOfLines={1}>
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
