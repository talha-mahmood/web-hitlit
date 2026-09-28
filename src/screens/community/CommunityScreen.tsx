import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, Dimensions, Image, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import PlayersDashboardContent from "../players/PlayersDashboardContent";
import CommunityChatContent from "./CommunityChatContent";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityHome">;
type Segment = "community" | "players" | "chat";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDE_PADDING = 16;
const GRID_GAP = 18;
// The four cards sit a little wider than the rest of the page content (they
// stretch out into the side margin), which makes each card — and, being
// square, its height too — a bit bigger.
const GRID_SIDE_PADDING = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GAP) / 2;
const CARD_TEXT_HEIGHT = 46;
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
}: {
  source?: number;
  // A drawn visual (see HeroVisual) used instead of a picture.
  visual?: ReactNode;
  onPress: () => void;
  title: string;
}) {
  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{
        ...cardShadow,
        backgroundColor: "white",
        width: CARD_WIDTH,
        borderRadius: 22,
      }}
    >
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {/* IMAGE — stays the same size */}
        {visual ?? (
          <Image
            source={source}
            style={{
              width: CARD_WIDTH,
              height: CARD_WIDTH,
            }}
            resizeMode="cover"
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
              fontSize: 18,
              lineHeight: 16,
              width: CARD_WIDTH - 20,
              textTransform: "uppercase",
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {title}
          </Text>
        </View>
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
}: {
  colorsFrom: [string, string];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accentIcons: (keyof typeof MaterialCommunityIcons.glyphMap)[];
}) {
  return (
    <LinearGradient
      colors={colorsFrom}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: CARD_WIDTH, height: CARD_WIDTH, alignItems: "center", justifyContent: "center" }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", width: CARD_WIDTH * 0.9, height: CARD_WIDTH * 0.9, borderRadius: CARD_WIDTH, backgroundColor: "white", opacity: 0.1, top: -CARD_WIDTH * 0.3, right: -CARD_WIDTH * 0.3 }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", width: CARD_WIDTH * 0.6, height: CARD_WIDTH * 0.6, borderRadius: CARD_WIDTH, backgroundColor: "white", opacity: 0.08, bottom: -CARD_WIDTH * 0.2, left: -CARD_WIDTH * 0.15 }}
      />
      <View
        className="items-center justify-center"
        style={{ width: CARD_WIDTH * 0.52, height: CARD_WIDTH * 0.52, borderRadius: CARD_WIDTH, backgroundColor: "rgba(255,255,255,0.2)" }}
      >
        <MaterialCommunityIcons name={icon} size={CARD_WIDTH * 0.3} color="white" />
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
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingTop: 16, paddingBottom: 40 }}>
      <View
        className="flex-row flex-wrap justify-between"
        style={{ rowGap: GRID_GAP, marginHorizontal: GRID_SIDE_PADDING - SIDE_PADDING }}
      >
        <ImageCard
          visual={<HeroVisual colorsFrom={["#22C55E", "#14532D"]} icon="message-text" accentIcons={["chat-processing", "account-group"]} />}
          onPress={onOpenChat}
          title="Community Chat"
        />
        <ImageCard
          visual={<HeroVisual colorsFrom={["#16A34A", "#15803D"]} icon="trophy" accentIcons={["star", "medal"]} />}
          onPress={onOpenPlayers}
          title="Top Players"
        />
        <ImageCard
          source={require("../../../assets/community-icons/host-game.png")}
          onPress={() => navigation.navigate("CreateGame", undefined)}
          title="Host Game"
        />
        <ImageCard
          source={require("../../../assets/community-icons/explore-games.png")}
          onPress={() => navigation.navigate("GamesList", undefined)}
          title="Explore Games"
        />
        <ImageCard
          source={require("../../../assets/community-icons/create-squad.png")}
          onPress={() => navigation.navigate("CreateSquad")}
          title="Create Squad"
        />
        <ImageCard
          source={require("../../../assets/community-icons/explore-squad.png")}
          onPress={() => navigation.navigate("SquadsList")}
          title="Explore Squads"
        />
      </View>
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
      <View
        style={{
          backgroundColor: "#14532D",
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
          <View
            className="items-center justify-center"
            style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: "#4CAF6A" }}
          >
            <MaterialCommunityIcons name="account-group" size={32} color="white" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-extrabold" style={{ fontSize: 23 }}>
              {segment === "players" ? "Top Players" : segment === "chat" ? "Community Chat" : "Community"}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 19, color: "#BBF7D0", marginTop: 2 }}>
              Play Together, Stay Active
            </Text>
          </View>
        </View>
      </View>

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
