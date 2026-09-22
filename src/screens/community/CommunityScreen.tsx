import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Dimensions, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import CommunityBanner from "../../components/CommunityBanner";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import Bouncy from "../../components/Bouncy";
import type { CommunityStackParamList } from "../../navigation/CommunityStackNavigator";
import PlayersDashboardContent from "../players/PlayersDashboardContent";
import CommunityChatContent from "./CommunityChatContent";

type Nav = NativeStackNavigationProp<CommunityStackParamList, "CommunityHome">;
type Segment = "community" | "players" | "chat";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDE_PADDING = 16;
const GRID_GAP = 8;
// The four cards sit a little wider than the rest of the page content (they
// stretch out into the side margin), which makes each card — and, being
// square, its height too — a bit bigger.
const GRID_SIDE_PADDING = 10;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GAP) / 2;

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
  title?: string;
  subtitle?: string;
}) {
  if (title) {
    return (
      <Bouncy
        onPress={onPress}
        scaleTo={0.97}
        // Shadow lives on this outer layer only — putting overflow:"hidden"
        // on the same view as the shadow can stop it (and the rounded-corner
        // clipping below) from actually rendering, so the border/corner
        // clipping is done on a separate inner View instead, same as
        // VenueListCard.
        style={{ ...cardShadow, backgroundColor: "white", width: CARD_WIDTH, borderRadius: 22 }}
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
          {/* Square, same aspect ratio as the source illustration, so
              "cover" shows the whole image instead of cropping its
              top/bottom to fit a shorter, wider box. */}
          <Image source={source} style={{ width: CARD_WIDTH, height: CARD_WIDTH }} resizeMode="cover" />
          <View className="px-4 pt-4 pb-4">
            <Text className="text-ink font-extrabold" style={{ fontSize: 20 }} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text className="text-muted" style={{ fontSize: 11, lineHeight: 15, marginTop: 4 }}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      </Bouncy>
    );
  }

  return (
    <Bouncy
      onPress={onPress}
      scaleTo={0.97}
      style={{ ...cardShadow, backgroundColor: "white", borderRadius: 22, width: CARD_WIDTH }}
    >
      <Image
        source={source}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: 22 }}
        resizeMode="cover"
      />
    </Bouncy>
  );
}

function MyCommunityContent({ navigation }: { navigation: Nav }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingTop: 4, paddingBottom: 40 }}>
      <View style={{ marginBottom: 14 }}>
        <CommunityBanner width={SCREEN_WIDTH - SIDE_PADDING * 2} />
      </View>

      <View
        className="flex-row flex-wrap justify-between"
        style={{ rowGap: GRID_GAP, marginHorizontal: GRID_SIDE_PADDING - SIDE_PADDING }}
      >
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
          title="Create Squad"
          subtitle="Create squad to chat with members"
        />
        <ImageCard
          source={require("../../../assets/community-icons/explore-squad.png")}
          onPress={() => navigation.navigate("SquadsList")}
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

  return (
    <View className="flex-1 bg-green-50">
      {/* Fixed header — stays on screen while only the content below switches. */}
      {/* Dark-green header: icon tile + title/subtitle, rounded at the bottom; the tab bar overlaps its lower edge. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <View
        style={{
          backgroundColor: "#14532D",
          paddingTop: insets.top + 12,
          paddingBottom: 40,
          paddingHorizontal: SIDE_PADDING + 2,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 14 }}>
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

      <View style={{ marginTop: -24, paddingHorizontal: SIDE_PADDING, marginBottom: 12 }}>
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
