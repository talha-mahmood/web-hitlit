import { Modal, View, Text, Pressable, Image, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import type { SeenByUser } from "../lib/api/chatReads";

function formatSeenTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Opened by long-pressing your own message — same idea as WhatsApp's
// "message info" seen-by list.
export default function SeenByModal({
  visible,
  onClose,
  seenBy,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  seenBy: SeenByUser[];
  isLoading: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View
          className="bg-white rounded-t-3xl px-5 pt-5"
          style={{ paddingBottom: 24 + insets.bottom, maxHeight: "70%", ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-ink">Seen By</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} className="mt-6 mb-6" />
          ) : seenBy.length === 0 ? (
            <Text className="text-muted text-sm text-center py-8">No one has seen this message yet.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}>
              {seenBy.map((u) => {
                const initials = (u.fullName ?? "?").charAt(0).toUpperCase();
                return (
                  <View key={u.userId} className="flex-row items-center py-2.5" style={{ gap: 10 }}>
                    {u.avatar ? (
                      <Image source={{ uri: u.avatar }} className="w-9 h-9 rounded-full bg-primary-light" />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-primary-light items-center justify-center">
                        <Text className="text-primary font-bold text-xs">{initials}</Text>
                      </View>
                    )}
                    <Text className="text-ink text-sm font-medium flex-1" numberOfLines={1}>
                      {u.fullName ?? "Player"}
                    </Text>
                    <Text className="text-muted text-xs">{formatSeenTime(u.lastReadAt)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
