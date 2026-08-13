import { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";

type VenueOption = { id: string; name: string; city: string | null };

const MAX_RESULTS = 30;

export default function VenueSearchField({
  venues,
  loading,
  selectedVenueId,
  onSelect,
  disabledReason,
}: {
  venues: VenueOption[] | undefined;
  loading: boolean;
  selectedVenueId: string | null;
  onSelect: (venueId: string) => void;
  // Shown instead of the search field when venue selection isn't available
  // yet (e.g. "Select a sport to see venues that offer it.").
  disabledReason?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focus = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  const selectedVenue = venues?.find((v) => v.id === selectedVenueId) ?? null;

  // Keep the input showing the selected venue's name (e.g. when editing an
  // existing game, or right after picking a suggestion) without fighting
  // the user's own typing while they're actively searching.
  useEffect(() => {
    if (!focused) {
      setQuery(selectedVenue?.name ?? "");
    }
  }, [selectedVenue?.id, selectedVenue?.name, focused]);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return venues ?? [];
    return (venues ?? []).filter((v) => v.name.toLowerCase().startsWith(trimmed));
  }, [venues, query]);

  const showDropdown = focused && !loading;

  const animatedFieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(focus.value, [0, 1], ["#FFFFFF", colors.primaryLight]),
  }));

  if (disabledReason) {
    return <Text className="text-muted text-sm">{disabledReason}</Text>;
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} />;
  }

  if (!venues || venues.length === 0) {
    return <Text className="text-muted text-sm">No venues found for this sport yet.</Text>;
  }

  return (
    <View>
      <Animated.View
        style={[
          { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 16, gap: 8, borderWidth: 1.5 },
          animatedFieldStyle,
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (selectedVenueId) onSelect(""); // typing invalidates the previous pick
          }}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current);
            setFocused(true);
            focus.value = withTiming(1, { duration: 160 });
          }}
          onBlur={() => {
            // Delay so a tap on a dropdown item registers before the list
            // unmounts (onBlur otherwise fires first and hides it).
            blurTimeout.current = setTimeout(() => setFocused(false), 150);
            focus.value = withTiming(0, { duration: 160 });
          }}
          placeholder="Search venue by name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          className="flex-1 py-3 text-ink"
        />
        {query.length > 0 && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
            <Pressable
              onPress={() => {
                setQuery("");
                if (selectedVenueId) onSelect("");
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.border} />
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>

      {showDropdown && (
        // Shadow lives on this outer, non-clipping wrapper — a shadow
        // doesn't render on a view with overflow:hidden (needed below to
        // clip the rows to the rounded corners), so it has to sit one
        // level up.
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={{ borderRadius: 16, marginTop: 6, maxHeight: 220, ...cardShadow }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: colors.border,
            }}
          >
            {matches.length === 0 ? (
              <Text className="text-muted text-sm px-4 py-3">No venues match "{query}".</Text>
            ) : (
              matches.slice(0, MAX_RESULTS).map((v) => (
                <Pressable
                  key={v.id}
                  // onPress fires after TextInput's onBlur on RN — fine, since
                  // selection doesn't depend on focus state.
                  onPress={() => {
                    onSelect(v.id);
                    setQuery(v.name);
                    setFocused(false);
                  }}
                  className={`px-4 py-3 border-b border-border ${v.id === selectedVenueId ? "bg-primary-light" : "bg-white"}`}
                >
                  <Text className="text-ink text-sm font-medium" numberOfLines={1}>
                    {v.name}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                    {v.city ?? "—"}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
