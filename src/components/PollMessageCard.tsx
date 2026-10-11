import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { usePollResult, useCastPollVote } from "../hooks/usePolls";

// The poll's own white rounded-2xl card, same card style as the rest of the
// app — rendered in place of the plain-text bubble content for any message
// whose poll_id is set. A fixed-ish width (capped so it still fits inside
// the chat bubble's own 75%-of-screen maxWidth) keeps every option bar the
// same width regardless of option text length, like a real poll.
export default function PollMessageCard({
  pollId,
  fallbackQuestion,
  viewerId,
  fullWidth,
}: {
  pollId: string;
  fallbackQuestion: string;
  viewerId: string | undefined;
  // Chat bubbles size this card to fit their own 75%-of-screen maxWidth;
  // a full-width post (the community feed) instead wants it to just fill
  // its already-constrained content column.
  fullWidth?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = fullWidth ? "100%" : Math.min(260, screenWidth * 0.68);
  const { data: poll, isLoading } = usePollResult(pollId, viewerId);
  const castVote = useCastPollVote(pollId);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

  const handleVote = (optionId: string) => {
    if (!viewerId || castVote.isPending || optionId === poll?.myOptionId) return;
    setPendingOptionId(optionId);
    castVote.mutate({ optionId, voterId: viewerId }, { onSettled: () => setPendingOptionId(null) });
  };

  const question = poll?.question ?? fallbackQuestion;
  const totalVotes = poll?.totalVotes ?? 0;

  return (
    <View className="bg-white rounded-2xl p-3" style={{ width: cardWidth, ...cardShadow }}>
      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
        <Ionicons name="bar-chart" size={15} color={colors.primary} />
        <Text className="text-primary text-xs font-bold">POLL</Text>
      </View>
      <Text className="text-ink font-bold text-sm mb-3">{question}</Text>

      {isLoading && !poll ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={{ gap: 8 }}>
          {poll?.options.map((option) => {
            const pct = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            const isMine = option.id === poll.myOptionId;
            const isPending = castVote.isPending && pendingOptionId === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => handleVote(option.id)}
                disabled={castVote.isPending}
                className="rounded-xl overflow-hidden"
                style={{ borderWidth: 1.5, borderColor: isMine ? colors.primary : colors.border }}
              >
                <View style={{ position: "relative" }}>
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: colors.primaryLight }}
                  />
                  <View className="flex-row items-center justify-between px-3 py-2.5">
                    <View className="flex-row items-center flex-1 mr-2" style={{ gap: 6 }}>
                      {isMine && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
                      <Text className="text-ink text-sm font-medium flex-1" numberOfLines={2}>
                        {option.text}
                      </Text>
                    </View>
                    {isPending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text className="text-muted text-xs font-bold">{pct}%</Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text className="text-muted text-xs mt-3">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
      </Text>
    </View>
  );
}
