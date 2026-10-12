import { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, TextInput, Image, Pressable, ActivityIndicator, ScrollView, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../constants/theme";

type VenueOption = { id: string; name: string; city: string | null };

const MAX_RESULTS = 30;

export default function VenueSearchField({
  venues,
  loading,
  selectedVenueId,
  customVenueName,
  onSelect,
  onSelectCustom,
  disabledReason,
  thumbnailSource,
}: {
  venues: VenueOption[] | undefined;
  loading: boolean;
  selectedVenueId: string | null;
  // A free-text venue name the user entered because their venue wasn't in
  // the dropdown — mutually exclusive with selectedVenueId (see
  // games_venue_or_custom_check). Optional so this component still works
  // wherever a caller hasn't wired up the custom-venue flow.
  customVenueName?: string | null;
  onSelect: (venueId: string) => void;
  onSelectCustom?: (name: string) => void;
  // Shown instead of the search field when venue selection isn't available
  // yet (e.g. "Select a sport to see venues that offer it.").
  disabledReason?: string;
  // Optional small preview image shown in place of the search icon once a
  // venue/custom name is picked and the field isn't focused — purely
  // decorative, doesn't change the search/select behavior below.
  thumbnailSource?: ImageSourcePropType | null;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setQuery(selectedVenue?.name ?? customVenueName ?? "");
    }
  }, [selectedVenue?.id, selectedVenue?.name, customVenueName, focused]);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return venues ?? [];
    return (venues ?? []).filter((v) => v.name.toLowerCase().startsWith(trimmed));
  }, [venues, query]);

  const trimmedQuery = query.trim();
  // Only offer "use as custom venue" once the typed text doesn't already
  // exactly match a real venue — otherwise picking a suggestion and typing
  // the custom option would do the same thing, which is confusing.
  const canUseCustom =
    !!onSelectCustom &&
    trimmedQuery.length > 0 &&
    !matches.some((v) => v.name.toLowerCase() === trimmedQuery.toLowerCase());

  const showDropdown = focused && !loading;

  if (disabledReason) {
    return <Text className="text-muted text-sm">{disabledReason}</Text>;
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} />;
  }

  return (
    <View>
      <View
        className="flex-row items-center rounded-2xl px-4"
        style={{
          gap: 8,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : "#CBD5E1",
          backgroundColor: focused ? colors.primaryLight : "white",
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 1,
        }}
      >
        {thumbnailSource && !focused && (selectedVenueId || customVenueName) ? (
          <Image source={thumbnailSource} style={{ width: 24, height: 24, borderRadius: 6 }} resizeMode="cover" />
        ) : (
          <Ionicons name={focused ? "search-outline" : "location-outline"} size={18} color={colors.muted} />
        )}
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            // Typing invalidates whichever pick was previously made.
            if (selectedVenueId) onSelect("");
            if (customVenueName) onSelectCustom?.("");
          }}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Delay so a tap on a dropdown item registers before the list
            // unmounts (onBlur otherwise fires first and hides it).
            blurTimeout.current = setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Search venue by name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          className="flex-1 py-3 text-ink"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery("");
              if (selectedVenueId) onSelect("");
              if (customVenueName) onSelectCustom?.("");
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.border} />
          </Pressable>
        )}
      </View>

      {showDropdown && (
        <View
          className="bg-white rounded-2xl mt-1.5 overflow-hidden"
          style={{ maxHeight: 260, borderWidth: 1.5, borderColor: colors.border, ...cardShadow }}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {matches.length === 0 && !canUseCustom && (
              <Text className="text-muted text-sm px-4 py-3">
                {venues && venues.length > 0 ? `No venues match "${query}".` : "No venues found for this sport yet."}
              </Text>
            )}
            {matches.slice(0, MAX_RESULTS).map((v) => (
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
            ))}
            {canUseCustom && (
              <Pressable
                onPress={() => {
                  onSelectCustom?.(trimmedQuery);
                  setQuery(trimmedQuery);
                  setFocused(false);
                }}
                className="flex-row items-center px-4 py-3"
                style={{ gap: 8 }}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text className="text-primary text-sm font-medium flex-1" numberOfLines={1}>
                  Use "{trimmedQuery}" as your venue
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
