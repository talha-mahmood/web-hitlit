import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getSportIcon } from "../../lib/sportIcons";
import { colors, heroShadow, primaryButtonShadow } from "../../constants/theme";
import GradientFill from "../../components/GradientFill";
import type { VenuesStackParamList } from "../../navigation/VenuesStackNavigator";

type ConfirmRoute = RouteProp<VenuesStackParamList, "BookingConfirmation">;
type ConfirmNav = NativeStackNavigationProp<VenuesStackParamList, "BookingConfirmation">;

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-PK", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0], 10);
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

function DetailRow({
  icon,
  label,
  value,
  divider = true,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      className="flex-row items-center py-3"
      style={{ gap: 12, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
      >
        <Ionicons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-base font-bold mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function BookingConfirmationScreen() {
  const { params } = useRoute<ConfirmRoute>();
  const navigation = useNavigation<ConfirmNav>();
  const [copied, setCopied] = useState(false);

  const { bookingIds, venueName, courtName, date, slots, totalAmount } = params;
  const referenceCode = bookingIds[0]?.slice(0, 8).toUpperCase() ?? "";
  const sportIconInfo = getSportIcon(params.sportName ?? "");

  const goToMyBookings = () => {
    // Navigate to the Profile tab → MyBookings nested screen
    navigation.dispatch(
      CommonActions.navigate({ name: "Profile", params: { screen: "MyBookings" } })
    );
  };

  const handleCopyReference = async () => {
    await Clipboard.setStringAsync(referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View className="flex-1 bg-app">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 24, paddingBottom: 32 }}
      >
        {/* Decorative header — a faint sport-icon watermark on each side
            (mirrored), same watermark language used across the booking
            flow, behind the success mark. */}
        <View style={{ width: "100%", height: 320, alignItems: "center", overflow: "hidden" }}>
          <MaterialCommunityIcons
            name={sportIconInfo.icon}
            size={130}
            color={colors.primary}
            style={{ position: "absolute", left: -20, top: 60, opacity: 0.12, transform: [{ rotate: "-18deg" }] }}
          />
          <MaterialCommunityIcons
            name={sportIconInfo.icon}
            size={150}
            color={colors.primary}
            style={{ position: "absolute", right: -30, top: 90, opacity: 0.1, transform: [{ scaleX: -1 }, { rotate: "10deg" }] }}
          />

          <View
            className="items-center justify-center rounded-full mt-12"
            style={{ width: 112, height: 112, backgroundColor: colors.primaryLight }}
          >
            <GradientFill
              className="items-center justify-center rounded-full"
              style={{ width: 84, height: 84 }}
            >
              <Ionicons name="checkmark" size={44} color="white" />
            </GradientFill>
          </View>

          <Text className="text-2xl font-extrabold text-ink mt-6 text-center">Booking Confirmed!</Text>
          <Text className="text-muted text-center mt-2 text-base leading-6">
            Your court is reserved.{"\n"}We'll see you on the field!
          </Text>
        </View>

        {/* Details Card — shadow lives on this outer, non-clipping wrapper
            since a shadow doesn't render on a view with overflow:hidden
            (needed to clip the header band's corners). */}
        <View className="w-full rounded-2xl" style={{ ...heroShadow, backgroundColor: colors.surface }}>
        <View className="w-full rounded-2xl overflow-hidden p-3">
          <View
            className="flex-row items-center rounded-2xl px-3 py-3 mb-1"
            style={{ backgroundColor: colors.primaryLight, gap: 10 }}
          >
            <View className="items-center justify-center rounded-full bg-surface" style={{ width: 34, height: 34 }}>
              <Ionicons name="document-text-outline" size={17} color={colors.primaryDark} />
            </View>
            <Text className="font-bold text-sm flex-1" style={{ color: colors.primaryDark }}>
              Booking Reference
            </Text>
            <Text className="font-extrabold text-sm" style={{ color: colors.primaryDark }}>
              {referenceCode}
              {bookingIds.length > 1 ? ` (+${bookingIds.length - 1} more)` : ""}
            </Text>
            <Pressable onPress={handleCopyReference} hitSlop={8} className="ml-1">
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={18}
                color={colors.primaryDark}
              />
            </Pressable>
          </View>

          <View className="px-1">
            <DetailRow icon="location-outline" label="Venue" value={venueName} />
            <DetailRow icon="tennisball-outline" label="Court" value={courtName} />
            <DetailRow icon="calendar-outline" label="Date" value={formatDateFull(date)} />
            <View className="flex-row items-start py-3" style={{ gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 36, height: 36, backgroundColor: colors.primaryLight }}
              >
                <Ionicons name="time-outline" size={17} color={colors.primaryDark} />
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs mb-2">
                  {slots.length} time slot{slots.length !== 1 ? "s" : ""}
                </Text>
                <View style={{ gap: 6 }}>
                  {slots.map((s) => (
                    <View
                      key={s.startTime}
                      className="flex-row items-center rounded-lg px-3 py-2"
                      style={{ backgroundColor: colors.surfaceOverlay, gap: 8 }}
                    >
                      <Ionicons name="time-outline" size={13} color={colors.muted} />
                      <Text className="text-ink text-sm font-bold">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View
              className="flex-row items-center justify-between rounded-xl px-3 py-3 mt-3"
              style={{ backgroundColor: colors.primaryLight, gap: 12 }}
            >
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="items-center justify-center rounded-full bg-surface" style={{ width: 34, height: 34 }}>
                  <Ionicons name="wallet-outline" size={16} color={colors.primaryDark} />
                </View>
                <Text className="text-ink font-medium">Total</Text>
              </View>
              <Text className="font-extrabold text-lg" style={{ color: colors.primaryDark }}>
                Rs {totalAmount.toLocaleString()}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-3 mt-1" style={{ gap: 12 }}>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 36, height: 36, backgroundColor: colors.warningLight }}
                >
                  <Ionicons name="card-outline" size={17} color="#D97706" />
                </View>
                <Text className="text-ink font-medium">Payment</Text>
              </View>
              <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.warningLight }}>
                <Text className="font-bold text-xs" style={{ color: "#B45309" }}>
                  Pay at venue
                </Text>
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      <View className="px-4 pb-8 pt-3 border-t border-border" style={{ gap: 10 }}>
        <Pressable onPress={goToMyBookings} style={primaryButtonShadow}>
          <GradientFill className="rounded-2xl py-4 flex-row items-center justify-center" style={{ gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color="white" />
            <Text className="text-jazba-white font-bold text-base">View My Bookings</Text>
            <Ionicons name="chevron-forward" size={18} color="white" />
          </GradientFill>
        </Pressable>
        <Pressable onPress={() => navigation.popToTop()} className="items-center py-3">
          <Text className="text-primary font-semibold">Back to Venues</Text>
        </Pressable>
      </View>
    </View>
  );
}
