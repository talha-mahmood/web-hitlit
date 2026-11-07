import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Alert, RefreshControl } from "react-native";
import { SkeletonCardRows } from "../../components/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  useContentReports,
  useRemoveReportedContent,
  useEjectUser,
  useDismissReport,
} from "../../hooks/useSuperadmin";
import { useUnreadNotificationCount } from "../../hooks/useNotifications";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import type { SuperAdminStackParamList } from "../../navigation/SuperAdminNavigator";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import NotificationBell from "../../components/NotificationBell";
import SearchField from "../../components/SearchField";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import type { ContentReport } from "../../lib/api/moderation";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList, "AdminModeration">;

const SOURCE_LABELS: Record<string, string> = {
  game_message: "Game chat",
  team_message: "Team chat",
  event_message: "Event chat",
  squad_message: "Squad chat",
  community_message: "Community",
  profile: "Profile",
};

// The admin-side half of App Store guideline 1.2's "act on objectionable
// content reports within 24 hours by removing the content and ejecting the
// user" requirement — mirrors AllEventsListScreen's exact layout. Every
// report filed via showReportBlockActions (chats, Community, Comment
// Thread, Player Profile) lands here, readable only by a superadmin thanks
// to content_reports_select_superadmin. fetchContentReports only ever
// returns unreviewed rows — once a report is resolved (content removed,
// user ejected, or dismissed) it drops off this list entirely. Reversing an
// eject done from here (if needed later) happens from the Users directory
// instead, since the report itself is gone by then.
export default function AdminModerationScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id);
  const { data: unreadCount } = useUnreadNotificationCount(viewerId);
  const { data: reports, isLoading, refetch, isRefetching } = useContentReports();
  const removeContent = useRemoveReportedContent(viewerId);
  const ejectUser = useEjectUser(viewerId);
  const dismissReport = useDismissReport(viewerId);
  const [search, setSearch] = useState("");

  const visibleReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports ?? [];
    return (reports ?? []).filter((r) => {
      const haystack = [
        r.reported?.full_name,
        r.reported?.email,
        r.reporter?.full_name,
        r.reporter?.email,
        r.reason,
        r.message_snapshot,
        SOURCE_LABELS[r.source] ?? r.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, search]);

  const handleRemoveContent = (report: ContentReport) => {
    if (report.source === "profile") {
      Alert.alert("Nothing to remove", "A profile report has no message content to delete. Use \"Eject User\" instead.");
      return;
    }
    Alert.alert("Remove Content", "Permanently delete the reported message? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeContent.mutate(report.id, {
            onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not remove content.")),
          }),
      },
    ]);
  };

  const handleEjectUser = (report: ContentReport) => {
    const name = report.reported?.full_name ?? report.reported?.email ?? "this user";
    Alert.alert(`Eject ${name}?`, "They'll be immediately signed out and unable to use the app again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Eject",
        style: "destructive",
        onPress: () =>
          ejectUser.mutate(
            { reportId: report.id, userId: report.reported_user_id },
            { onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not eject user.")) }
          ),
      },
    ]);
  };

  const handleDismiss = (report: ContentReport) => {
    dismissReport.mutate(report.id, {
      onError: (err) => Alert.alert("Error", getFriendlyErrorMessage(err, "Could not dismiss report.")),
    });
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="px-3.5" style={{ paddingTop: insets.top + 16, paddingBottom: 12 }}>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <SuperAdminSectionSwitcher active="moderation" />
            <Text className="text-2xl font-bold text-ink">Reports</Text>
          </View>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={() => navigation.navigate("AdminNotifications")}
          />
        </View>
        <SearchField
          value={search}
          onChangeText={setSearch}
          prefix="Search by "
          variants={["reported user", "reporter", "reason"]}
        />
      </View>

      {isLoading ? (
        <View className="px-3.5"><SkeletonCardRows /></View>
      ) : (
        <FlatList
          data={visibleReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="flag-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">
                {search.trim() ? `No reports match "${search.trim()}"` : "No reports."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-surface border border-border rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: colors.primaryLight }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                    {SOURCE_LABELS[item.source] ?? item.source}
                  </Text>
                </View>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: colors.dangerLight }}>
                  <Text className="text-xs font-semibold" style={{ color: colors.danger }}>
                    Unreviewed
                  </Text>
                </View>
              </View>

              <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                Reported: {item.reported?.full_name ?? item.reported?.email ?? "Unknown user"}
              </Text>
              <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                By {item.reporter?.full_name ?? item.reporter?.email ?? "Unknown"} · {item.reason}
              </Text>
              {item.message_snapshot ? (
                <Text className="text-ink text-xs mt-2 italic" numberOfLines={2}>
                  "{item.message_snapshot}"
                </Text>
              ) : null}
              <Text className="text-muted text-xs mt-2">{formatCommunityTimeAgo(item.created_at)}</Text>

              <View className="flex-row items-center mt-3" style={{ gap: 16 }}>
                <Pressable onPress={() => handleRemoveContent(item)} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text className="text-xs font-semibold" style={{ color: colors.danger }}>
                    Remove Content
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleEjectUser(item)} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
                  <Ionicons name="person-remove-outline" size={15} color={colors.danger} />
                  <Text className="text-xs font-semibold" style={{ color: colors.danger }}>
                    Eject User
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDismiss(item)} className="flex-row items-center" style={{ gap: 5 }} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.muted} />
                  <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
                    Dismiss
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
