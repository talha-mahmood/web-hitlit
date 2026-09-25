import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Dimensions, Image, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
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
const CARD_TEXT_HEIGHT = 105;
// Every card uses a provided illustration that already has its own title +
// subtitle baked into the image itself — no extra text/icon overlay needed,
// except the Create Squad card, which gets a banner-image-then-title layout
// copied from VenueListCard (VenuesListScreen.tsx): a top image, then a
// padded title/subtitle block underneath.
function ImageCard({
  source,
  onPress,
  title,
  subtitle,
}: {
  source: number;
  onPress: () => void;
  title: string;
  subtitle?: string;
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
        <Image
          source={source}
          style={{
            width: CARD_WIDTH,
            height: CARD_WIDTH,
          }}
          resizeMode="cover"
        />

        {/* TEXT AREA — this is what gets bigger */}
        <View
          style={{
            height: CARD_TEXT_HEIGHT,
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 10,
            justifyContent: "flex-start",
          }}
        >
          <Text
            className="text-ink font-extrabold"
            style={{
              fontSize: 17,
              lineHeight: 21,
              width: CARD_WIDTH - 28,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>

          {subtitle && (
            <Text
              className="text-muted"
              style={{
                fontSize: 11,
                lineHeight: 15,
                marginTop: 5,
                width: CARD_WIDTH - 28,
              }}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </Bouncy>
  );
}

function MyCommunityContent({ navigation }: { navigation: Nav }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingTop: 4, paddingBottom: 40 }}>
      <View
        className="flex-row flex-wrap justify-between"
        style={{ rowGap: GRID_GAP, marginHorizontal: GRID_SIDE_PADDING - SIDE_PADDING }}
      >
        <ImageCard
          source={require("../../../assets/community-icons/host-game.png")}
          onPress={() => navigation.navigate("CreateGame", undefined)}
          title="Host Game/Tournament"
          subtitle="Bring your squad together and compete"
        />
        <ImageCard
          source={require("../../../assets/community-icons/explore-games.png")}
          onPress={() => navigation.navigate("GamesList", undefined)}
          title="Explore Games/Tournaments"
          subtitle="Discover new games and join exciting tournaments"
        />
        <ImageCard
          source={require("../../../assets/community-icons/create-squad.png")}
          onPress={() => navigation.navigate("CreateSquad")}
          title="Create Squad"
          subtitle="Create squad to chat with members"
        />
        <ImageCard
          source={require("../../../assets/community-icons/explore-squad.png")}
          onPress={() => navigation.navigate("SquadsList")}
          title="Explore Squads"
          subtitle="Explore & join squads in around you"
        />
      </View>
    </ScrollView>
  );
}

function SegmentButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center rounded-full"
      style={{ paddingVertical: 12, gap: 6, backgroundColor: active ? colors.primary : "transparent" }}
    >
      <MaterialCommunityIcons name={icon} size={18} color={active ? "white" : colors.ink} style={active ? undefined : { opacity: 0.75 }} />
      <Text
        className={active ? "text-white font-bold" : "text-ink font-semibold"}
        style={[{ fontSize: 12 }, active ? null : { opacity: 0.75 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
        if (navigation.canGoBack()) return false;
        navigation.getParent()?.navigate("Home");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  return (
    <View className="flex-1 bg-green-50">
      {/* Fixed header — stays on screen while only the content below switches. */}
      {/* Dark-green header: icon tile + title/subtitle, rounded at the bottom; the tab bar overlaps its lower edge. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <View
        style={{
          backgroundColor: "#14532D",
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 14 }}>
          <Pressable
            onPress={() => {
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
              Community
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 19, color: "#BBF7D0", marginTop: 2 }}>
              Play Together, Stay Active
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingTop: 16, paddingHorizontal: SIDE_PADDING, marginBottom: 12 }}>
        <View className="flex-row items-center bg-white" style={{ borderRadius: 30, padding: 4, ...cardShadow }}>
          <SegmentButton label="My Community" icon="account-group" active={segment === "community"} onPress={() => setSegment("community")} />
          <SegmentButton label="Top Players" icon="trophy-outline" active={segment === "players"} onPress={() => setSegment("players")} />
          {segment === "community" ? (
            <View style={{ width: 1, height: 22, backgroundColor: "#E5E7EB" }} />
          ) : null}
          <SegmentButton label="Community Chat" icon="message-text-outline" active={segment === "chat"} onPress={() => setSegment("chat")} />
        </View>
      </View>

      {segment === "community" && <MyCommunityContent navigation={navigation} />}
      {segment === "players" && (
        <PlayersDashboardContent
          onPressPlayer={(userId, sport) =>
            navigation.navigate("PlayerProfile", { userId, sportId: sport?.id, sportName: sport?.name })
          }
        />
      )}
      {segment === "chat" && (
        <CommunityChatContent onReply={(rootId) => navigation.navigate("CommentThread", { rootId })} />
      )}
    </View>
  );
}
