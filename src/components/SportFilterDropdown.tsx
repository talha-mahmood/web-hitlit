import { View, Text, Pressable, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";

type Sport = { id: string; name: string };

// A vertical, bordered dropdown panel of sport options — sits inline (not
// an absolute overlay), so opening it pushes the list below it down rather
// than covering any cards. Capped at a max height with internal scroll so
// a long sport list still reads as a compact dropdown, not a sprawling page.
export default function SportFilterDropdown({
  sports,
  selectedSportId,
  onSelect,
}: {
  sports: Sport[];
  selectedSportId: string | undefined;
  onSelect: (sportId: string | undefined) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      style={{
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: "#0A1723",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        maxHeight: 280,
        overflow: "hidden",
        ...cardShadow,
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {sports.map((sport, i) => {
          const selected = selectedSportId === sport.id;
          return (
            <Pressable
              key={sport.id}
              onPress={() => onSelect(selected ? undefined : sport.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 13,
                backgroundColor: selected ? colors.primaryLight : "#0A1723",
                borderBottomWidth: i === sports.length - 1 ? 0 : 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: selected ? colors.primary : colors.ink,
                  fontWeight: selected ? "700" : "500",
                  fontSize: 14,
                }}
              >
                {sport.name}
              </Text>
              {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
          );
        })}
        {sports.length === 0 && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>No sports found.</Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}
