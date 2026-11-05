import { View, Text, FlatList, Pressable, ActivityIndicator, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useBlockedUsers, useUnblockUser } from "../../hooks/useModeration";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { BlockedUser } from "../../lib/api/moderation";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "BlockedUsers">;

export default function BlockedUsersScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: blocked, isLoading } = useBlockedUsers(userId);
  const unblockUser = useUnblockUser(userId);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(`Unblock ${user.profiles?.full_name ?? "this user"}?`, "You'll see their messages again in chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () =>
          unblockUser.mutate(user.blocked_id, {
            onError: (err) =>
              Alert.alert("Error", getFriendlyErrorMessage(err, "Could not unblock user.")),
          }),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-app">
      <View className="flex-row items-center px-4 pb-4 border-b border-border bg-surface" style={{ paddingTop: insets.top + 16 }}>
        <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-base font-bold text-ink">Blocked Users</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={blocked ?? []}
          keyExtractor={(u) => u.blocked_id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={({ item }) => {
            const name = item.profiles?.full_name ?? "Player";
            return (
              <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 mb-2 border border-border">
                <Pressable onPress={() => navigation.navigate("PlayerProfile", { userId: item.blocked_id })}>
                  {item.profiles?.avatar ? (
                    <Image source={{ uri: item.profiles.avatar }} className="w-10 h-10 rounded-full bg-primary-light mr-3" />
                  ) : (
                    <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center mr-3">
                      <Text className="text-primary font-bold">{name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </Pressable>
                <Text className="flex-1 text-ink font-medium">{name}</Text>
                <Pressable onPress={() => handleUnblock(item)} className="px-3 py-1.5 rounded-full border border-border">
                  <Text className="text-ink text-sm font-medium">Unblock</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-muted text-sm text-center">You haven't blocked anyone.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
