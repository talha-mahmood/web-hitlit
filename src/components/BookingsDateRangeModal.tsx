import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, type DateData } from "react-native-calendars";
import { colors } from "../constants/theme";
import GradientFill from "./GradientFill";
import { toLocalDateStr } from "../lib/slots";

export type DateSelection = { start: string; end: string };

type MarkedDate = {
  startingDay?: boolean;
  endingDay?: boolean;
  color: string;
  textColor: string;
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function buildMarkedDates(start: string | null, end: string | null): Record<string, MarkedDate> {
  if (!start) return {};
  const marks: Record<string, MarkedDate> = {};
  const e = end ?? start;
  const [s, realEnd] = start <= e ? [start, e] : [e, start];

  if (s === realEnd) {
    marks[s] = { startingDay: true, endingDay: true, color: colors.primary, textColor: "white" };
    return marks;
  }

  let cursor = s;
  while (cursor <= realEnd) {
    const isStart = cursor === s;
    const isEnd = cursor === realEnd;
    marks[cursor] = {
      startingDay: isStart,
      endingDay: isEnd,
      color: isStart || isEnd ? colors.primary : colors.primaryLight,
      textColor: isStart || isEnd ? "white" : colors.ink,
    };
    cursor = addDays(cursor, 1);
  }
  return marks;
}

function formatShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BookingsDateRangeModal({
  visible,
  initialSelection,
  onClose,
  onSave,
  onClear,
}: {
  visible: boolean;
  initialSelection: DateSelection | null;
  onClose: () => void;
  onSave: (selection: DateSelection) => void;
  // Optional — this same sheet is also used for a required, always-set date
  // (the admin Bookings tab), where "no date" isn't a meaningful state. Only
  // passed where a date range is an actual optional filter (the Games
  // list's own Date filter); the Clear link only renders when it's given.
  onClear?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<string | null>(initialSelection?.start ?? null);
  const [end, setEnd] = useState<string | null>(initialSelection?.end ?? null);
  // Tracks whether the next tap should start a fresh selection or extend
  // the current one into a range — same two-tap pattern as Android's
  // Material date-range picker (tap once = a day, tap a second, different
  // day = a range; tap again after that = start over).
  const [awaitingEnd, setAwaitingEnd] = useState(false);

  const markedDates = useMemo(() => buildMarkedDates(start, end), [start, end]);

  const handleDayPress = (day: DateData) => {
    const dateStr = day.dateString;
    if (!awaitingEnd) {
      setStart(dateStr);
      setEnd(dateStr);
      setAwaitingEnd(true);
      return;
    }
    if (dateStr === start) {
      setAwaitingEnd(false);
      return;
    }
    if (start && dateStr < start) {
      setEnd(start);
      setStart(dateStr);
    } else {
      setEnd(dateStr);
    }
    setAwaitingEnd(false);
  };

  const handleSave = () => {
    if (!start) {
      onClose();
      return;
    }
    onSave({ start, end: end ?? start });
  };

  const rangeLabel = !start ? "No date selected" : start === (end ?? start) ? formatShort(start) : `${formatShort(start)} – ${formatShort(end ?? start)}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 bg-gray-100">
        <GradientFill style={{ paddingTop: insets.top + 12, paddingBottom: 20, paddingHorizontal: 20 }}>
          <View className="flex-row items-center justify-between mb-5">
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
            <View className="flex-row items-center" style={{ gap: 18 }}>
              {onClear && start && (
                <Pressable onPress={onClear} hitSlop={10}>
                  <Text className="text-white font-semibold text-sm" style={{ opacity: 0.85 }}>
                    Clear
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={handleSave} hitSlop={10}>
                <Text className="text-white font-bold text-sm">SAVE</Text>
              </Pressable>
            </View>
          </View>
          <Text className="text-white/80 text-xs font-semibold" style={{ letterSpacing: 1 }}>
            SELECTED {start && start !== (end ?? start) ? "RANGE" : "DAY"}
          </Text>
          <Text className="text-white font-bold text-3xl mt-1">{rangeLabel}</Text>
        </GradientFill>

        <Calendar
          current={start ?? toLocalDateStr(new Date())}
          markingType="period"
          markedDates={markedDates}
          onDayPress={handleDayPress}
          theme={{
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            monthTextColor: colors.ink,
            textMonthFontWeight: "700",
            textMonthFontSize: 15,
            textDayFontSize: 14,
            textDayHeaderFontSize: 12,
            textSectionTitleColor: colors.muted,
            dayTextColor: colors.ink,
            textDisabledColor: colors.border,
          }}
          style={{ paddingBottom: 20 }}
        />
      </View>
    </Modal>
  );
}
