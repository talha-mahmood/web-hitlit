import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import type { SuperAdminStackParamList } from "../navigation/SuperAdminNavigator";
import { signOutGoogle } from "../lib/googleAuth";
import { signOutWithPushCleanup } from "../lib/pushNotifications";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList>;
type SectionKey = "venues" | "games" | "groups" | "events" | "moderation" | "users";

const ITEMS: {
  key: SectionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: "AllVenuesList" | "AllGamesList" | "AllGroupsList" | "AllEventsList" | "AdminModeration" | "AllUsersList";
}[] = [
  { key: "venues", label: "Venues", icon: "business-outline", screen: "AllVenuesList" },
  { key: "games", label: "Games", icon: "trophy-outline", screen: "AllGamesList" },
  { key: "groups", label: "Groups", icon: "people-outline", screen: "AllGroupsList" },
  { key: "events", label: "Events", icon: "calendar-outline", screen: "AllEventsList" },
  { key: "moderation", label: "Reports", icon: "flag-outline", screen: "AdminModeration" },
  { key: "users", label: "Users", icon: "person-outline", screen: "AllUsersList" },
];

// A hamburger icon that opens a left-side drawer listing every superadmin
// section plus Sign Out — this is the only way a superadmin reaches any of
// these lists, since superadmin accounts never see MainTabNavigator (see
// RootNavigator). Replaces the old inline pill-row switcher now that there
// are six sections — a one-line row of pills doesn't scale past four or five.
export default function SuperAdminSectionSwitcher({ active }: { active: SectionKey }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setOpen(false);
    await signOutGoogle();
    signOutWithPushCleanup();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        className="items-center justify-center"
        style={{ width: 28, height: 28 }}
      >
        <Ionicons name="menu" size={24} color={colors.ink} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: 250,
              height: "100%",
              backgroundColor: colors.surface,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 10,
              ...cardShadow,
            }}
          >
            <Text className="text-xs font-bold px-3 mb-3" style={{ color: colors.muted, letterSpacing: 0.5 }}>
              SUPERADMIN
            </Text>

            {ITEMS.map((item) => {
              const isActive = item.key === active;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setOpen(false);
                    if (!isActive) navigation.navigate(item.screen);
                  }}
                  className="flex-row items-center rounded-xl px-3 py-3 mb-1"
                  style={isActive ? { backgroundColor: colors.primaryLight } : undefined}
                >
                  <Ionicons name={item.icon} size={18} color={isActive ? colors.primary : colors.muted} />
                  <Text
                    className="ml-3 text-sm font-semibold"
                    style={{ color: isActive ? colors.primary : colors.ink }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            <View style={{ flex: 1 }} />

            <View className="border-t border-border pt-3">
              <Pressable onPress={handleSignOut} hitSlop={8} className="flex-row items-center rounded-xl px-3 py-3">
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text className="ml-3 text-sm font-semibold" style={{ color: colors.danger }}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
