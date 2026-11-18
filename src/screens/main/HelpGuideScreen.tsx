import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, cardShadow } from "../../constants/theme";
import { USER_GUIDE, type GuideChapter } from "../../content/userGuide";
import type { ProfileStackParamList } from "../../navigation/ProfileStackNavigator";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "HelpGuide">;

function searchableChapter(chapter: GuideChapter, query: string) {
  if (!query) return chapter;
  const normalized = query.trim().toLocaleLowerCase();
  const chapterMatches = `${chapter.title} ${chapter.intro}`.toLocaleLowerCase().includes(normalized);
  const sections = chapterMatches
    ? chapter.sections
    : chapter.sections.filter((section) =>
        `${section.title} ${section.body} ${(section.steps ?? []).join(" ")} ${section.tip ?? ""}`
          .toLocaleLowerCase()
          .includes(normalized)
      );
  return sections.length ? { ...chapter, sections } : null;
}

export default function HelpGuideScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const chapterOffsets = useRef<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(USER_GUIDE[0]?.id ?? null);

  const chapters = useMemo(
    () => USER_GUIDE.map((chapter) => searchableChapter(chapter, query)).filter((chapter): chapter is GuideChapter => chapter !== null),
    [query]
  );

  const openChapter = (chapter: GuideChapter) => {
    setExpandedId(chapter.id);
    const y = chapterOffsets.current[chapter.id];
    if (y != null) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }));
  };

  return (
    <View className="flex-1 bg-app">
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="items-center justify-center rounded-full bg-surfaceRaised"
            style={{ width: 42, height: 42 }}
          >
            <Ionicons name="arrow-back" size={21} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-ink text-xl font-extrabold">Help & User Guide</Text>
            <Text className="text-muted text-xs mt-0.5">Learn your way around HitLit</Text>
          </View>
          <View className="items-center justify-center rounded-full" style={{ width: 42, height: 42, backgroundColor: colors.primaryLight }}>
            <Ionicons name="book-outline" size={20} color={colors.primary} />
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 36 }}>
        <View className="bg-surface rounded-2xl p-4 mb-4 border border-border" style={cardShadow}>
          <View className="flex-row items-start" style={{ gap: 12 }}>
            <View className="items-center justify-center rounded-2xl" style={{ width: 48, height: 48, backgroundColor: colors.primaryLight }}>
              <Ionicons name="football-outline" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-lg font-extrabold">Your HitLit playbook</Text>
              <Text className="text-muted text-sm leading-5 mt-1">
                A practical guide to finding games, organizing teams, following scores, booking venues, and using your account.
              </Text>
            </View>
          </View>
          <View className="flex-row items-center mt-4 rounded-xl px-3 py-2.5" style={{ backgroundColor: colors.infoLight, gap: 8 }}>
            <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
            <Text className="text-muted text-xs flex-1">This guide reflects features currently available in the app. Search it or choose a chapter below.</Text>
          </View>
        </View>

        <View className="flex-row items-center bg-surface border border-border rounded-2xl px-3 mb-3" style={{ minHeight: 48, gap: 9 }}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the guide..."
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search the user guide"
            returnKeyType="search"
            className="flex-1 text-ink text-sm py-3"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {!query.trim() && (
          <View className="mb-5">
            <Text className="text-ink font-bold text-sm mb-2">Browse chapters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {USER_GUIDE.map((chapter, index) => (
                <Pressable
                  key={chapter.id}
                  onPress={() => openChapter(chapter)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chapter ${index + 1}: ${chapter.title}`}
                  className="flex-row items-center rounded-full border border-border bg-surface px-3 py-2"
                  style={{ gap: 6 }}
                >
                  <Text className="text-primary font-bold text-xs">{String(index + 1).padStart(2, "0")}</Text>
                  <Text className="text-ink text-xs font-semibold">{chapter.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-ink font-bold text-sm">{query.trim() ? "Search results" : "Guide chapters"}</Text>
          <Text className="text-muted text-xs">{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</Text>
        </View>

        {chapters.length === 0 ? (
          <View className="bg-surface rounded-2xl border border-border items-center px-5 py-8" style={cardShadow}>
            <View className="items-center justify-center rounded-full mb-3" style={{ width: 48, height: 48, backgroundColor: colors.surfaceRaised }}>
              <Ionicons name="search-outline" size={22} color={colors.muted} />
            </View>
            <Text className="text-ink font-bold">No guide results</Text>
            <Text className="text-muted text-sm text-center mt-1">Try another feature name or clear your search.</Text>
          </View>
        ) : (
          chapters.map((chapter) => {
            const expanded = query.trim().length > 0 || expandedId === chapter.id;
            const originalIndex = USER_GUIDE.findIndex((item) => item.id === chapter.id);
            return (
              <View
                key={chapter.id}
                onLayout={(event) => { chapterOffsets.current[chapter.id] = event.nativeEvent.layout.y; }}
                className="bg-surface rounded-2xl border border-border mb-3 overflow-hidden"
                style={cardShadow}
              >
                <Pressable
                  onPress={() => setExpandedId(expanded ? null : chapter.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  className="flex-row items-center p-4"
                  style={{ gap: 12 }}
                >
                  <View className="items-center justify-center rounded-xl" style={{ width: 42, height: 42, backgroundColor: colors.primaryLight }}>
                    <Ionicons name={chapter.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-primary text-[10px] font-bold tracking-wider">CHAPTER {String(originalIndex + 1).padStart(2, "0")}</Text>
                    <Text className="text-ink font-bold text-base mt-0.5">{chapter.title}</Text>
                    {!expanded && <Text className="text-muted text-xs mt-1" numberOfLines={2}>{chapter.intro}</Text>}
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                </Pressable>

                {expanded && (
                  <View className="px-4 pb-4">
                    <Text className="text-muted text-sm leading-5 mb-3">{chapter.intro}</Text>
                    {chapter.sections.map((section, sectionIndex) => (
                      <View key={`${chapter.id}-${section.title}`} className="rounded-xl border border-border p-3 mb-2.5" style={{ backgroundColor: colors.surfaceRaised }}>
                        <View className="flex-row items-start" style={{ gap: 9 }}>
                          <View className="items-center justify-center rounded-full mt-0.5" style={{ width: 23, height: 23, backgroundColor: colors.primaryLight }}>
                            <Text className="text-primary text-[10px] font-extrabold">{sectionIndex + 1}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-ink font-bold text-sm">{section.title}</Text>
                            <Text className="text-muted text-sm leading-5 mt-1">{section.body}</Text>
                            {section.steps?.map((step, index) => (
                              <View key={`${section.title}-step-${index}`} className="flex-row mt-2" style={{ gap: 8 }}>
                                <Text className="text-primary font-bold text-xs">{index + 1}.</Text>
                                <Text style={{ color: colors.inkSecondary, fontSize: 12, lineHeight: 20, flex: 1 }}>{step}</Text>
                              </View>
                            ))}
                            {section.tip && (
                              <View className="flex-row rounded-lg px-2.5 py-2 mt-3" style={{ backgroundColor: colors.primaryLight, gap: 7 }}>
                                <Ionicons name="bulb-outline" size={15} color={colors.primary} />
                                <Text style={{ color: colors.inkSecondary, fontSize: 12, lineHeight: 16, flex: 1 }}>{section.tip}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <Text className="text-muted text-[11px] text-center leading-4 mt-2 px-3">
          Screens and options can vary by sport, membership, account permissions, and available data.
        </Text>
      </ScrollView>
    </View>
  );
}
