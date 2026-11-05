import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, Image, ScrollView, Alert, KeyboardAvoidingView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { useUserSearch } from "../hooks/useInvites";
import type { UserSearchResult } from "../lib/api/users";
import FieldInput from "./FieldInput";
import { getFriendlyErrorMessage } from "../lib/friendlyError";

// A percentage maxHeight ("80%") resolves against the KeyboardAvoidingView's
// own auto-sized height (it isn't flex:1), which Yoga computes differently
// depending on how much content is inside — with just one search result the
// sheet's intrinsic height collapses almost to nothing instead of the
// intended 80% of the screen. Using an explicit pixel value sidesteps that.
const MODAL_MAX_HEIGHT = Dimensions.get("window").height * 0.8;

// Reused by GameDetailScreen (host inviting to a game/tournament) and
// SquadDetailScreen (owner inviting to a squad) — the only thing that
// differs between them is what `onInvite` actually does server-side.
export default function InviteUsersModal({
  visible,
  onClose,
  excludeIds,
  onInvite,
  title = "Invite Players",
}: {
  visible: boolean;
  onClose: () => void;
  // Users already on the roster or already invited — filtered out of results
  // so the host can't send a duplicate invite from this picker.
  excludeIds: string[];
  onInvite: (user: UserSearchResult) => Promise<void>;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const [searchInput, setSearchInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!visible) {
      setSearchInput("");
      setDebounced("");
      setInvitingId(null);
      setInvitedIds(new Set());
    }
  }, [visible]);

  const { data: results, isLoading } = useUserSearch(debounced, excludeIds);

  const handleInvite = async (user: UserSearchResult) => {
    setInvitingId(user.id);
    try {
      await onInvite(user);
      setInvitedIds((prev) => new Set(prev).add(user.id));
    } catch (err) {
      Alert.alert("Error", getFriendlyErrorMessage(err, "Could not send invite."));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
        <View
          className="bg-surface rounded-t-3xl px-5 pt-5"
          style={{ maxHeight: MODAL_MAX_HEIGHT, paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <FieldInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search by name, email, or user ID"
            autoCapitalize="none"
            autoCorrect={false}
            left={<Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
          />

          <ScrollView className="mt-4" keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} className="mt-6" />
            ) : !debounced ? (
              <Text className="text-muted text-sm text-center mt-6">
                Start typing a name or email to find players.
              </Text>
            ) : (results ?? []).length === 0 ? (
              <Text className="text-muted text-sm text-center mt-6">
                No players found for "{debounced}".
              </Text>
            ) : (
              (results ?? []).map((user) => {
                const isInvited = invitedIds.has(user.id);
                const isInviting = invitingId === user.id;
                return (
                  <View
                    key={user.id}
                    className="flex-row items-center py-2.5 border-b border-border"
                    style={{ gap: 10 }}
                  >
                    {user.avatar ? (
                      <Image source={{ uri: user.avatar }} className="w-10 h-10 rounded-full bg-primary-light" />
                    ) : (
                      <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center">
                        <Text className="text-primary font-bold text-sm">
                          {(user.full_name ?? "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-ink font-medium text-sm" numberOfLines={1}>
                        {user.full_name ?? "Unnamed player"}
                      </Text>
                      <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                        ID: {user.user_code}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleInvite(user)} disabled={isInvited || isInviting}>
                      {isInvited ? (
                        <View className="rounded-lg px-3 py-2 flex-row items-center bg-green-50" style={{ gap: 4 }}>
                          {isInviting ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={14} color={colors.primary} />
                              <Text className="text-primary text-xs font-semibold">Invited</Text>
                            </>
                          )}
                        </View>
                      ) : (
                        <GradientFill className="rounded-lg px-3 py-2 flex-row items-center" style={{ gap: 4 }}>
                          {isInviting ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text className="text-jazba-white text-xs font-semibold">Invite</Text>
                          )}
                        </GradientFill>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
