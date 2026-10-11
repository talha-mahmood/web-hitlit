import { Modal, View, Text, Pressable, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import type { PollResult } from "../lib/api/polls";

// WhatsApp's poll results screen: every option, most-voted first, with the
// avatar + name of each person who picked it — opened by tapping the vote
// count on a poll (PollMessageCard), not by tapping an option itself
// (that casts your own vote instead). Same bottom-sheet shape as
// SeenByModal, which this is essentially a per-option version of.
export default function PollResultsModal({
  visible,
  onClose,
  poll,
}: {
  visible: boolean;
  onClose: () => void;
  poll: PollResult | undefined;
}) {
  const insets = useSafeAreaInsets();
  const options = [...(poll?.options ?? [])].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 24 + insets.bottom, maxHeight: "80%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-1 mr-3">
              <Text className="text-lg font-bold text-ink" numberOfLines={2}>
                {poll?.question ?? "Poll results"}
              </Text>
              <Text className="text-muted text-xs mt-0.5">
                {poll?.totalVotes ?? 0} vote{(poll?.totalVotes ?? 0) === 1 ? "" : "s"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}>
            {options.map((option) => (
              <View key={option.id} className="mt-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-ink font-bold text-sm flex-1 mr-2" numberOfLines={2}>
                    {option.text}
                  </Text>
                  <Text className="text-muted text-xs font-semibold">
                    {option.voteCount} vote{option.voteCount === 1 ? "" : "s"}
                  </Text>
                </View>
                {option.voters.length === 0 ? (
                  <Text className="text-muted text-xs pb-1">No votes yet</Text>
                ) : (
                  option.voters.map((voter) => {
                    const initials = (voter.fullName ?? "?").charAt(0).toUpperCase();
                    return (
                      <View key={voter.id} className="flex-row items-center py-2" style={{ gap: 10 }}>
                        {voter.avatar ? (
                          <Image source={{ uri: voter.avatar }} className="w-9 h-9 rounded-full bg-primary-light" />
                        ) : (
                          <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                            <Text className="text-primary font-bold text-xs">{initials}</Text>
                          </View>
                        )}
                        <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                          {voter.fullName ?? "Player"}
                        </Text>
                      </View>
                    );
                  })
                )}
                <View className="h-px bg-border mt-2" />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
