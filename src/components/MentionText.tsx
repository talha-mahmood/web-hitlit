import { useState } from "react";
import { Text, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors } from "../constants/theme";
import { useMentionEntityExists } from "../hooks/useMentions";
import { splitTextWithMentions, type Mention } from "../lib/mentionParser";
import type { CommunityStackParamList } from "../navigation/CommunityStackNavigator";

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

const ENTITY_LABEL: Record<Mention["entityType"], string> = {
  player: "player",
  game: "game",
  tournament: "tournament",
  squad: "squad",
};

// Community Public Chat's message body renderer — plain text stays plain,
// each stored mention becomes its own pressable, highlighted span. Reused
// by both the main feed and comment-thread screens (both live in
// CommunityStackParamList, which is what every mention here navigates
// within — see the routing table in the feature's own spec).
export default function MentionText({
  body,
  mentions,
  className,
  numberOfLines,
}: {
  body: string;
  mentions: Mention[] | null | undefined;
  // Applied to the wrapping Text — every plain-text/mention span inside it
  // inherits font size/color/weight from it the same way any nested RN
  // Text does, so callers style this exactly like a plain <Text>.
  className?: string;
  numberOfLines?: number;
}) {
  const navigation = useNavigation<Nav>();
  const checkExists = useMentionEntityExists();
  const [checkingKey, setCheckingKey] = useState<string | null>(null);

  const segments = splitTextWithMentions(body, mentions);

  const handlePressMention = async (mention: Mention) => {
    const key = `${mention.entityType}:${mention.entityId}`;
    if (checkingKey) return; // ignore a second tap while one check is in flight
    setCheckingKey(key);
    try {
      const exists = await checkExists(mention.entityType, mention.entityId);
      if (!exists) {
        Alert.alert(
          "No longer available",
          `This ${ENTITY_LABEL[mention.entityType]} has been removed or is no longer available.`
        );
        return;
      }
      switch (mention.entityType) {
        case "player":
          navigation.navigate("PlayerProfile", { userId: mention.entityId });
          return;
        case "game":
        case "tournament":
          navigation.navigate("GameDetail", { gameId: mention.entityId });
          return;
        case "squad":
          navigation.navigate("SquadDetail", { squadId: mention.entityId });
          return;
      }
    } finally {
      setCheckingKey(null);
    }
  };

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          return <Text key={i}>{segment.text}</Text>;
        }
        const key = `${segment.mention.entityType}:${segment.mention.entityId}`;
        const isChecking = checkingKey === key;
        return (
          <Text
            key={i}
            onPress={() => handlePressMention(segment.mention)}
            suppressHighlighting={false}
            style={{ color: colors.primary, fontWeight: "700", opacity: isChecking ? 0.5 : 1 }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
