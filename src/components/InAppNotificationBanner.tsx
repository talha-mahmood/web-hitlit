import { useCallback, useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { colors, heroShadow } from "../constants/theme";

type Props = {
  notification: Notifications.Notification | null;
  onDismiss: (identifier: string) => void;
  onPress: () => void;
};

function notificationIcon(data: Record<string, unknown>) {
  const type = String(data.type ?? data.event ?? "").toLowerCase();
  if (type.includes("challenge") || type.includes("fixture") || type.includes("tournament")) return "trophy-outline" as const;
  if (type.includes("message") || type.includes("chat")) return "chatbubble-ellipses-outline" as const;
  if (type.includes("venue") || type.includes("booking")) return "location-outline" as const;
  return "notifications-outline" as const;
}

export default function InAppNotificationBanner({ notification, onDismiss, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissedId = useRef<string | null>(null);
  const identifier = notification?.request.identifier ?? null;
  const content = notification?.request.content;
  const data = (content?.data ?? {}) as Record<string, unknown>;
  const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === "string" && !!value.trim())?.trim() ?? "";
  const title = textValue(content?.title, data.title);
  const body = textValue(content?.body, content?.subtitle, data.body, data.message);

  const dismiss = useCallback((id: string) => {
    if (dismissedId.current === id) return;
    dismissedId.current = id;
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDismiss(id);
    });
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    if (!identifier) return;
    dismissedId.current = null;
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, speed: 18, bounciness: 5, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => dismiss(identifier), 5500);
    return () => clearTimeout(timer);
  }, [dismiss, identifier, opacity, translateY]);

  if (!notification || !identifier || (!title && !body)) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 14,
        right: 14,
        zIndex: 1000,
        elevation: 20,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View className="overflow-hidden rounded-2xl border border-border bg-surface" style={heroShadow}>
        <View className="flex-row items-start px-3.5 py-3" style={{ gap: 10 }}>
          <Pressable onPress={onPress} className="flex-1 flex-row items-start" style={{ gap: 10 }} accessibilityRole="button" accessibilityLabel="Open notification inbox">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: colors.primaryLight }}>
              <Ionicons name={notificationIcon(data)} size={19} color={colors.primary} />
            </View>
            <View className="flex-1">
              {title ? <Text className="text-ink font-bold" style={{ fontSize: 14 }}>{title}</Text> : null}
              {body ? (
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 96 }}>
                  <Text className="text-muted" style={{ fontSize: 12.5, lineHeight: 18 }}>{body}</Text>
                </ScrollView>
              ) : null}
            </View>
          </Pressable>
          <Pressable onPress={() => dismiss(identifier)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss notification" className="h-8 w-7 items-center justify-center">
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
