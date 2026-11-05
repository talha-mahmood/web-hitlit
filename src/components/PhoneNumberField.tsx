import { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { COUNTRY_CODES } from "../lib/countryCodes";

// Country-code dropdown + a digits-only input capped at `maxDigits`
// characters (the caller passes a tighter cap for countries with a single
// fixed length, e.g. 10 for Pakistan, and a looser one otherwise — the
// caller still validates the exact rule on submit in case the field is
// left short). `onFocus` lets the caller scroll a bottom-pinned button into
// view above the keyboard when this field is focused.
export default function PhoneNumberField({
  dial,
  onChangeDial,
  number,
  onChangeNumber,
  maxDigits = 14,
  onFocus,
}: {
  dial: string;
  onChangeDial: (dial: string) => void;
  number: string;
  onChangeNumber: (number: string) => void;
  maxDigits?: number;
  onFocus?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = COUNTRY_CODES.find((c) => c.dial === dial) ?? COUNTRY_CODES[0];

  return (
    <View>
      <View
        className="flex-row items-center rounded-2xl pl-3 pr-4"
        style={{
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : colors.border,
          backgroundColor: focused ? colors.primaryLight : "#0A1723",
        }}
      >
        <Pressable
          onPress={() => setOpen((o) => !o)}
          className="flex-row items-center py-3 pr-3 mr-3"
          style={{ gap: 4, borderRightWidth: 1, borderRightColor: colors.border }}
        >
          <Text style={{ fontSize: 16 }}>{selected.flag}</Text>
          <Text className="text-ink font-medium" style={{ fontSize: 15 }}>
            {selected.dial}
          </Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={number}
          onChangeText={(t) => onChangeNumber(t.replace(/[^0-9]/g, "").slice(0, maxDigits))}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          placeholder="3001234567"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={maxDigits}
          className="flex-1 text-ink"
          style={{ paddingVertical: 12 }}
        />
      </View>

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
            maxHeight: 260,
            overflow: "hidden",
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} nestedScrollEnabled>
            {COUNTRY_CODES.map((c, i) => {
              const isSelected = c.iso === selected.iso;
              return (
                <Pressable
                  key={c.iso}
                  onPress={() => {
                    onChangeDial(c.dial);
                    setOpen(false);
                  }}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    gap: 10,
                    backgroundColor: isSelected ? colors.primaryLight : "#0A1723",
                    borderBottomWidth: i === COUNTRY_CODES.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{c.flag}</Text>
                  <Text
                    className="flex-1 text-ink"
                    style={{ fontWeight: isSelected ? "700" : "500", fontSize: 14 }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text className="text-muted" style={{ fontSize: 13 }}>
                    {c.dial}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}
