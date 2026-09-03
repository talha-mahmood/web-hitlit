import { Modal, View, Text, Pressable, ScrollView, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

type MenuItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
};

// Mirrors the venue-owner web dashboard's left sidebar, but as a full-screen
// mobile overlay (there's no room for a persistent sidebar on a phone) —
// opened via the hamburger icon in the dashboard header, closed via the same
// icon (now an X) or by tapping a nav item that navigates away.
export default function AdminMenuOverlay({
  visible,
  onClose,
  activeKey,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  activeKey: string;
  items: MenuItem[];
}) {
  const insets = useSafeAreaInsets();

  const comingSoon = (label: string) => {
    onClose();
    Alert.alert(label, "This section is coming in a future update.");
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-[#0F172A]" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-5 py-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="tennisball" size={22} color={colors.primary} />
            <Text className="text-white text-lg font-bold">playoye</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color="white" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <Pressable
                key={item.key}
                onPress={() => (item.onPress ? item.onPress() : comingSoon(item.label))}
                className="flex-row items-center rounded-xl px-4 py-3 mb-1"
                style={{ backgroundColor: active ? colors.primary : "transparent", gap: 14 }}
              >
                <Ionicons name={item.icon} size={20} color={active ? "white" : "#9CA3AF"} />
                <Text className={`text-base ${active ? "text-white font-semibold" : "text-gray-300"}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-5" style={{ paddingBottom: insets.bottom + 20 }}>
          <Pressable
            onPress={() => Linking.openURL("mailto:mahmoodhamza1261@gmail.com?subject=PlayOye%20Support")}
            className="flex-row items-center"
            style={{ gap: 10 }}
          >
            <Ionicons name="help-circle-outline" size={20} color="#9CA3AF" />
            <Text className="text-gray-300 text-sm">Need Help? Visit Help Center</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
