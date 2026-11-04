import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAllUsers, useSetUserActive } from "../../hooks/useSuperadmin";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";
import type { AllUsersListItem } from "../../lib/api/superadmin";
import SearchField from "../../components/SearchField";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import NotificationBell from "../../components/NotificationBell";
import GradientFill from "../../components/GradientFill";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AllUsersList">;

const TYPE_LABEL: Record<string, string> = { user: "Player", owner: "Venue Admin", superadmin: "Superadmin" };

function Avatar({ name, avatar }: { name: string | null; avatar: string | null }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  if (avatar) {
    return <Image source={{ uri: avatar }} className="w-11 h-11 rounded-full bg-primary-light" />;
  }
  return (
    <GradientFill className="w-11 h-11 rounded-full items-center justify-center">
      <Text className="text-white font-bold text-sm">{initials}</Text>
    </GradientFill>
  );
}

// The full user directory — the only way to find and reactivate someone
// after they've been ejected from the Reports screen, since a resolved
// report (and the eject action taken on it) no longer appears there. Every
// user gets the same isactive toggle here regardless of how/why they were
// last ejected.
export default function AllUsersListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id);
  const { data: unreadCount } = useUnreadNotificationCount(viewerId);
  const [search, setSearch] = useState("");
  const { data: users, isLoading, refetch, isRefetching } = useAllUsers(search || undefined);
  const setActive = useSetUserActive();

  const handleEject = (user: AllUsersListItem) => {
    Alert.alert(
      `Eject ${user.full_name ?? "this user"}?`,
      "They'll be immediately signed out and unable to use the app again, until reactivated here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Eject",
          style: "destructive",
          onPress: () =>
            setActive.mutate(
              { userId: user.id, isActive: false },
              { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not eject user.")) }
            ),
        },
      ]
    );
  };

  const handleReactivate = (user: AllUsersListItem) => {
    Alert.alert(`Reactivate ${user.full_name ?? "this user"}?`, "They'll be able to sign in and use the app again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reactivate",
        onPress: () =>
          setActive.mutate(
            { userId: user.id, isActive: true },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not reactivate user.")) }
          ),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-3.5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <SuperAdminSectionSwitcher active="users" />
            <Text className="text-2xl font-bold text-ink">All Users</Text>
          </View>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={() => navigation.navigate("AdminNotifications")}
          />
        </View>
        <SearchField value={search} onChangeText={setSearch} prefix="Search by " variants={["name", "email", "user code"]} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="person-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No users found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isEjected = item.isactive === false;
            return (
              <View className="flex-row items-center bg-white border border-border rounded-2xl p-4" style={{ gap: 12 }}>
                <Avatar name={item.full_name} avatar={item.avatar} />
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Text className="text-ink font-semibold text-sm flex-1" numberOfLines={1}>
                      {item.full_name ?? "Unnamed"}
                    </Text>
                    {isEjected && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: "#FEE2E2" }}>
                        <Text className="text-xs font-semibold" style={{ color: colors.danger }}>
                          Ejected
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                    {item.email ?? item.phone ?? "No contact info"}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: colors.primaryDark }} numberOfLines={1}>
                    {TYPE_LABEL[item.type] ?? item.type} · {item.user_code}
                  </Text>
                </View>
                {item.type === "superadmin" ? null : isEjected ? (
                  <Pressable
                    onPress={() => handleReactivate(item)}
                    className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: colors.primaryLight }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                      Reactivate
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => handleEject(item)} hitSlop={8}>
                    <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
