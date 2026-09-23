import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";
import { subscribeAlert, type AppAlertState } from "../lib/alertStore";

// Renders every `Alert.alert(...)` call in the app (see alertPolyfill) as
// this one custom dialog — white rounded card, tinted icon circle, bold
// title, muted message, and Cancel/action buttons — instead of the native
// OS alert. Mounted once at the app root.
//
// Styling is kept entirely in `style` (no `className`) since mixing
// layout-critical className with a style prop on the same element has
// repeatedly and silently dropped the className in this codebase.
export default function CustomAlertHost() {
  const [state, setState] = useState<AppAlertState>(null);

  useEffect(() => subscribeAlert(setState), []);

  if (!state) return null;

  const isDestructive = state.buttons.some((b) => b.style === "destructive");
  const hasCancel = state.buttons.some((b) => b.style === "cancel");
  const iconBg = isDestructive ? "#FEF2F2" : colors.primaryLight;
  const iconColor = isDestructive ? colors.danger : colors.primaryDark;
  const iconName = isDestructive
    ? "warning-outline"
    : hasCancel
      ? "help-circle-outline"
      : "information-circle-outline";
  const stacked = state.buttons.length > 2;

  const close = (onPress?: () => void) => {
    setState(null);
    // Let the modal finish dismissing before the caller's own onPress runs
    // (it may itself navigate, open another modal, etc.).
    if (onPress) setTimeout(onPress, 0);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close()}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 28,
          backgroundColor: "rgba(15,23,42,0.5)",
        }}
      >
        <Pressable
          onPress={() => close()}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 26,
            padding: 24,
            width: "100%",
            maxWidth: 360,
            alignItems: "center",
            ...cardShadow,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name={iconName} size={34} color={iconColor} />
          </View>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 20, textAlign: "center" }}>
            {state.title}
          </Text>
          {!!state.message && (
            <Text
              style={{ color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 20 }}
            >
              {state.message}
            </Text>
          )}
          <View style={{ width: "100%", marginTop: 22, flexDirection: stacked ? "column" : "row", gap: 10 }}>
            {state.buttons.map((b, i) => {
              const isCancel = b.style === "cancel";
              const isDanger = b.style === "destructive";
              const bg = isCancel ? "white" : isDanger ? colors.danger : colors.primary;
              const textColor = isCancel ? "#374151" : "white";
              return (
                <Pressable
                  key={i}
                  onPress={() => close(b.onPress)}
                  style={{
                    flex: stacked ? undefined : 1,
                    width: stacked ? "100%" : undefined,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                    paddingVertical: 14,
                    backgroundColor: bg,
                    borderWidth: isCancel ? 1.5 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: textColor, fontWeight: "700", fontSize: 16 }}>{b.text ?? "OK"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
