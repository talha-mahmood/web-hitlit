import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { PAKISTAN_CITIES } from "../lib/pakistanCities";

export default function SelectChallengeCityModal({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onSelect: (city: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);
  const cities = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return PAKISTAN_CITIES.filter((city) => !query || city.toLocaleLowerCase().includes(query));
  }, [search]);

  function select(city: string | null) {
    onSelect(city);
    setSearch("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.68)" }}>
        <View className="overflow-hidden rounded-t-3xl border-t border-border bg-surface" style={{ height: "82%", maxHeight: "88%", paddingBottom: Math.max(insets.bottom, 14) }}>
          <View className="items-center pt-2.5 pb-2">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View className="flex-row items-center justify-between px-5 py-3">
            <Text className="text-ink text-xl font-bold">Select City</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close city selector" hitSlop={8} className="h-9 w-9 items-center justify-center">
              <Ionicons name="close" size={26} color={colors.muted} />
            </Pressable>
          </View>
          <View className="mx-4 mb-3 flex-row items-center rounded-2xl border px-3.5" style={{ minHeight: 54, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surfaceRaised }}>
            <Ionicons name="search-outline" size={21} color={colors.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search cities..." placeholderTextColor={colors.muted} className="ml-2 flex-1 text-ink" style={{ fontSize: 16 }} autoCapitalize="words" autoCorrect={false} returnKeyType="search" />
            {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
          </View>
          <View className="flex-1" style={{ borderTopWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => select(null)} className="flex-row items-center justify-between px-4" style={{ minHeight: 54, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: value === null ? colors.primaryLight : "transparent" }}>
              <Text style={{ color: value === null ? colors.primary : colors.muted, fontSize: 17 }}>All Cities</Text>
              {value === null ? <Ionicons name="checkmark" size={23} color={colors.primary} /> : null}
            </Pressable>
            <FlatList
              data={cities}
              style={{ flex: 1 }}
              keyExtractor={(city) => city}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = value?.toLocaleLowerCase() === item.toLocaleLowerCase();
                return (
                  <Pressable onPress={() => select(item)} className="flex-row items-center justify-between px-4" style={{ minHeight: 54, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: selected ? colors.primaryLight : "transparent" }}>
                    <Text style={{ color: selected ? colors.primary : colors.ink, fontSize: 17 }}>{item}</Text>
                    {selected ? <Ionicons name="checkmark" size={23} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<View className="items-center py-10"><Text className="text-muted">No matching cities</Text></View>}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
