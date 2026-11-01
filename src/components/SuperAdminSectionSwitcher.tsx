import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import type { SuperAdminStackParamList } from "../navigation/SuperAdminNavigator";
import { signOutGoogle } from "../lib/googleAuth";
import { signOutWithPushCleanup } from "../lib/pushNotifications";

type Nav = NativeStackNavigationProp<SuperAdminStackParamList>;

const TABS: { key: "venues" | "games" | "groups"; label: string; icon: keyof typeof Ionicons.glyphMap; screen: "AllVenuesList" | "AllGamesList" | "AllGroupsList" }[] = [
  { key: "venues", label: "Venues", icon: "business-outline", screen: "AllVenuesList" },
  { key: "games", label: "Games", icon: "trophy-outline", screen: "AllGamesList" },
  { key: "groups", label: "Groups", icon: "people-outline", screen: "AllGroupsList" },
];

// Lets a superadmin jump between the three moderation lists — this is the
// only way they can reach "All Games"/"All Groups" at all, since superadmin
// accounts never see MainTabNavigator (see RootNavigator).
export default function SuperAdminSectionSwitcher({ active }: { active: "venues" | "games" | "groups" }) {
  const navigation = useNavigation<Nav>();

  return (
    <View className="flex-row items-center bg-gray-100 rounded-xl p-1 mb-4" style={{ gap: 4 }}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => !isActive && navigation.navigate(tab.screen)}
            className="flex-1 flex-row items-center justify-center rounded-lg py-2"
            style={isActive ? { backgroundColor: "white", ...cardShadow } : undefined}
          >
            <Ionicons name={tab.icon} size={14} color={isActive ? colors.primary : colors.muted} />
            <Text className="ml-1 text-xs font-semibold" style={{ color: isActive ? colors.primary : colors.muted }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={async () => {
          await signOutGoogle();
          signOutWithPushCleanup();
        }}
        hitSlop={8}
        className="items-center justify-center rounded-lg py-2 px-2.5"
      >
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
      </Pressable>
    </View>
  );
}
