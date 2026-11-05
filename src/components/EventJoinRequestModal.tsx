import { useState } from "react";
import { Modal, View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, heroShadow, primaryButtonShadow } from "../constants/theme";
import GradientFill from "./GradientFill";
import { SectionLabel } from "./GameFormControls";
import LocationPickerField from "./LocationPickerField";

// Same bottom-sheet chrome as JoinRequestModal (Squads/Games) but without
// the Skill Level step — events don't carry a skill level at all.
export default function EventJoinRequestModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  title = "Request to Join",
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (location: string) => void;
  submitting: boolean;
  title?: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState("");

  const canSend = !!location.trim();

  const handleSend = () => {
    if (!canSend) return;
    onSubmit(location.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <KeyboardAvoidingView behavior="padding">
          <View
            className="bg-surface rounded-t-3xl px-5 pt-3"
            style={{ paddingBottom: 32 + insets.bottom, ...heroShadow, shadowOffset: { width: 0, height: -6 } }}
          >
            <View
              style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 }}
            />
            <Pressable onPress={onClose} hitSlop={8} style={{ position: "absolute", top: 14, right: 16, zIndex: 1 }}>
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
                <Ionicons name="calendar" size={24} color={colors.primaryDark} />
                <GradientFill
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "white",
                  }}
                >
                  <Ionicons name="add" size={11} color="white" />
                </GradientFill>
              </View>
              <View style={{ flex: 1, marginLeft: 14, marginRight: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{title}</Text>
                {!!subtitle && (
                  <Text style={{ color: colors.muted, fontSize: 13.5, marginTop: 4, lineHeight: 19 }}>{subtitle}</Text>
                )}
              </View>
            </View>

            <SectionLabel title="Your Location" required />
            <LocationPickerField value={location} onChange={setLocation} showPinIcon />

            <Pressable onPress={handleSend} disabled={!canSend || submitting} className="mt-6" style={canSend ? primaryButtonShadow : undefined}>
              {canSend ? (
                <GradientFill className="flex-row items-center justify-center py-4" style={{ borderRadius: 28 }}>
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="send" size={17} color="white" style={{ marginRight: 8 }} />
                      <Text className="font-bold text-base text-jazba-white">Send Request</Text>
                    </>
                  )}
                </GradientFill>
              ) : (
                <View className="flex-row items-center justify-center py-4" style={{ borderRadius: 28, backgroundColor: "#1C2D3A" }}>
                  {submitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="send" size={17} color={colors.muted} style={{ marginRight: 8 }} />
                      <Text className="font-bold text-base text-muted">Send Request</Text>
                    </>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
