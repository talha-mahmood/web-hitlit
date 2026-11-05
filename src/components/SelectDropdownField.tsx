import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";

// Generic single-select dropdown — trigger row + an inline options panel
// (pushes content below it down, no absolute overlay), matching
// SportFilterDropdown's interaction pattern for a fixed list of choices.
export default function SelectDropdownField({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between border border-border rounded-xl px-4"
        style={{ height: 48 }}
      >
        <Text style={{ fontSize: 15, color: value ? colors.ink : colors.muted }}>{value || placeholder}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open && (
        <Animated.View
          entering={FadeInDown.duration(150)}
          exiting={FadeOutUp.duration(120)}
          style={{
            ...cardShadow,
            backgroundColor: "#0A1723",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 6,
            overflow: "hidden",
          }}
        >
          {options.map((opt, i) => {
            const selected = opt === value;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="flex-row items-center justify-between px-4 py-3"
                style={{
                  backgroundColor: selected ? colors.primaryLight : "#0A1723",
                  borderBottomWidth: i === options.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: selected ? colors.primary : colors.ink, fontWeight: selected ? "700" : "500", fontSize: 14 }}>
                  {opt}
                </Text>
                {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
