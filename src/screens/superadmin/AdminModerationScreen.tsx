import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useContentReports,
  useRemoveReportedContent,
  useEjectUser,
  useDismissReport,
} from "../../hooks/useSuperadmin";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../constants/theme";
import SuperAdminSectionSwitcher from "../../components/SuperAdminSectionSwitcher";
import { getFriendlyErrorMessage } from "../../lib/friendlyError";
import { formatCommunityTimeAgo } from "../../lib/communityTime";
import type { ContentReport } from "../../lib/api/moderation";

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
// to content_reports_select_superadmin.
export default function AdminModerationScreen() {
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id);
  const { data: reports, isLoading, refetch, isRefetching } = useContentReports();
  const removeContent = useRemoveReportedContent(viewerId);
  const ejectUser = useEjectUser(viewerId);
  const dismissReport = useDismissReport(viewerId);

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
          <Text className="text-2xl font-bold text-ink">Reports</Text>
        </View>
        <SuperAdminSectionSwitcher active="moderation" />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} className="mt-8" />
      ) : (
        <FlatList
          data={reports ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="border border-dashed border-border rounded-2xl p-8 items-center">
              <Ionicons name="flag-outline" size={32} color={colors.border} />
              <Text className="text-muted text-sm text-center mt-2">No reports.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isReviewed = !!item.reviewed_at;
            return (
              <View className="bg-white border border-border rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: colors.primaryLight }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.primaryDark }}>
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </Text>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: isReviewed ? "#F3F4F6" : "#FEE2E2" }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: isReviewed ? colors.muted : colors.danger }}>
                      {isReviewed ? (item.action_taken ?? "Reviewed") : "Unreviewed"}
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

                {!isReviewed && (
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
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
