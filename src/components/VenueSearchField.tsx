import { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Bouncy from "./Bouncy";
import { colors, fonts } from "../constants/theme";

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

  if (disabledReason) {
    return (
      <Text style={{ fontFamily: fonts.medium }} className="text-muted text-sm">
        {disabledReason}
      </Text>
    );
  }

  if (loading) {
    return <ActivityIndicator color={colors.sky} />;
  }

  if (!venues || venues.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.medium }} className="text-muted text-sm">
        No venues found for this sport yet.
      </Text>
    );
  }

  return (
    <View>
      <View
        className="flex-row items-center rounded-2xl px-4"
        style={{
          gap: 8,
          borderWidth: 1.5,
          borderColor: focused ? colors.sky : colors.border,
          backgroundColor: focused ? colors.skyLight : "white",
        }}
      >
        <Ionicons name="search-outline" size={18} color={focused ? colors.sky : colors.muted} />
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (selectedVenueId) onSelect(""); // typing invalidates the previous pick
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
          autoCapitalize="words"
          autoCorrect={false}
          style={{ fontFamily: fonts.medium }}
          className="flex-1 py-3 text-ink"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery("");
              if (selectedVenueId) onSelect("");
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {showDropdown && (
        <View
          className="rounded-2xl mt-1.5 overflow-hidden"
          style={{ maxHeight: 220, borderWidth: 1.5, borderColor: colors.border }}
        >
          {matches.length === 0 ? (
            <Text style={{ fontFamily: fonts.medium }} className="text-muted text-sm px-4 py-3">
              No venues match "{query}".
            </Text>
          ) : (
            matches.slice(0, MAX_RESULTS).map((v, i) => (
              <Bouncy
                key={v.id}
                scaleTo={0.99}
                // onPress fires after TextInput's onBlur on RN — fine, since
                // selection doesn't depend on focus state.
                onPress={() => {
                  onSelect(v.id);
                  setQuery(v.name);
                  setFocused(false);
                }}
                className="px-4 py-3"
                style={{
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: v.id === selectedVenueId ? colors.skyLight : "white",
                }}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className="text-ink text-sm"
                  numberOfLines={1}
                >
                  {v.name}
                </Text>
                <Text
                  style={{ fontFamily: fonts.medium }}
                  className="text-muted text-xs mt-0.5"
                  numberOfLines={1}
                >
                  {v.city ?? "—"}
                </Text>
              </Bouncy>
            ))
          )}
        </View>
      )}
    </View>
  );
}
