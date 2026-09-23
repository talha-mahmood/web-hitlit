import { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import type { Database } from "../types/database.types";
import { SectionLabel } from "./GameFormControls";
import LocationPickerField from "./LocationPickerField";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

const SKILL_LEVELS: { label: string; value: SkillLevel }[] = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Expert", value: "expert" },
];

function SkillPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 14,
        borderRadius: 26,
        backgroundColor: selected ? colors.primary : "white",
        borderWidth: selected ? 0 : 1.5,
        borderColor: colors.border,
        ...(selected ? primaryButtonShadow : null),
      }}
    >
      <Ionicons name="bar-chart" size={15} color={selected ? "white" : colors.muted} />
      <Text style={{ color: selected ? "white" : colors.ink, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function JoinRequestModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  title = "Request to Join",
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (skillLevel: SkillLevel, location: string) => void;
  submitting: boolean;
  title?: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [location, setLocation] = useState("");

  const canSend = !!skillLevel && !!location.trim();

  const handleSend = () => {
    if (!canSend || !skillLevel) return;
    onSubmit(skillLevel, location.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        {/* "padding" on both platforms — this sheet is bottom-anchored
            (justify-end) with fixed, non-scrolling content, so padding
            pushes the whole sheet up above the keyboard instead of leaving
            the location field hidden behind it. */}
        <KeyboardAvoidingView behavior="padding">
          {/* Shadow points up (negative height) since this sheet rises from
              the bottom of the screen — a downward shadow would just be
              hidden below the screen edge. */}
          <View
            className="bg-white rounded-t-3xl px-5 pt-3"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View
              style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 }}
            />
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ position: "absolute", top: 14, right: 16, zIndex: 1 }}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.primaryLight,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="people" size={24} color={colors.primaryDark} />
                <View
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "white",
                  }}
                >
                  <Ionicons name="add" size={11} color="white" />
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: 14, marginRight: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{title}</Text>
                {!!subtitle && (
                  <Text style={{ color: colors.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>

            <SectionLabel title="Your Skill Level" required />
            <View style={{ flexDirection: "row", gap: 10 }}>
              {SKILL_LEVELS.map((s) => (
                <SkillPill
                  key={s.value}
                  label={s.label}
                  selected={skillLevel === s.value}
                  onPress={() => setSkillLevel(s.value)}
                />
              ))}
            </View>

            <SectionLabel title="Your Location" required />
            <LocationPickerField value={location} onChange={setLocation} showPinIcon />

            <Pressable
              onPress={handleSend}
              disabled={!canSend || submitting}
              className="flex-row items-center justify-center py-4 mt-6"
              style={{
                borderRadius: 28,
                backgroundColor: canSend ? colors.primary : "#E5E7EB",
                ...(canSend ? primaryButtonShadow : null),
              }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="send" size={17} color={canSend ? "white" : colors.muted} style={{ marginRight: 8 }} />
                  <Text className={`font-bold text-base ${canSend ? "text-white" : "text-muted"}`}>
                    Send Request
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
