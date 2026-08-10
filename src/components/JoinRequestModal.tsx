import { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import type { Database } from "../types/database.types";
import { SectionLabel, PillRow } from "./GameFormControls";
import LocationPickerField from "./LocationPickerField";

type SkillLevel = Database["public"]["Enums"]["skill_level_type"];

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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ paddingBottom: 32 }}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-lg font-bold text-ink">{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {!!subtitle && <Text className="text-muted text-sm mb-2">{subtitle}</Text>}

            <SectionLabel title="Your Skill Level" required />
            <PillRow<SkillLevel>
              options={[
                { label: "Beginner", value: "beginner" },
                { label: "Intermediate", value: "intermediate" },
                { label: "Expert", value: "expert" },
              ]}
              value={skillLevel}
              onChange={setSkillLevel}
            />

            <SectionLabel title="Your Location" required />
            <LocationPickerField value={location} onChange={setLocation} />

            <Pressable
              onPress={handleSend}
              disabled={!canSend || submitting}
              className={`rounded-xl py-4 items-center mt-6 ${canSend ? "bg-primary" : "bg-gray-200"}`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className={`font-semibold text-base ${canSend ? "text-white" : "text-muted"}`}>
                  Send Request
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
