import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

export type PromoSlide = {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  accentColor: string;
  onPress: () => void;
};

// Fallback estimate used only until the container's real width is measured
// via onLayout (below) — avoids a zero-width flash on first paint. The real
// width is whatever the parent gives this component (full column width,
// screen-edge-to-edge, etc.), so this component makes no assumption about
// its own placement/padding.
const FALLBACK_WIDTH = Dimensions.get("window").width - 40;
const CARD_HEIGHT = 172;
const AUTO_ADVANCE_MS = 4500;

function PromoCard({ slide, width }: { slide: PromoSlide; width: number }) {
  return (
    <Pressable
      onPress={slide.onPress}
      style={{ width, height: CARD_HEIGHT, backgroundColor: slide.bgColor }}
      className="rounded-3xl overflow-hidden px-6 py-5 justify-between"
    >
      {/* Soft translucent "glow" shapes stand in for a gradient — no native
          gradient library required, so this renders via plain hot-reload. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: slide.accentColor,
          opacity: 0.16,
          top: -90,
          right: -70,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: slide.accentColor,
          opacity: 0.1,
          bottom: -60,
          left: -40,
        }}
      />
      <Ionicons
        name={slide.icon}
        size={104}
        color={slide.accentColor}
        style={{ position: "absolute", right: -6, bottom: -14, opacity: 0.16 }}
      />

      <View style={{ maxWidth: "76%" }}>
        <Text
          style={{ color: slide.accentColor, letterSpacing: 1.4 }}
          className="text-[11px] font-bold uppercase mb-1.5"
        >
          PlayOye
        </Text>
        <Text className="text-white text-xl font-extrabold leading-6" numberOfLines={2}>
          {slide.title}
        </Text>
        <Text className="text-white text-sm mt-1.5 opacity-80" numberOfLines={2}>
          {slide.subtitle}
        </Text>
      </View>

      <View
        className="flex-row items-center self-start rounded-full px-4 py-2"
        style={{ backgroundColor: slide.accentColor, gap: 6 }}
      >
        <Text className="text-xs font-bold" style={{ color: slide.bgColor }}>
          {slide.cta}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={slide.bgColor} />
      </View>
    </Pressable>
  );
}

export default function PromoCarousel({ slides }: { slides: PromoSlide[] }) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<PromoSlide>>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    if (measured > 0 && measured !== width) setWidth(measured);
  };

  // Self-scheduling timer: reschedules off the *current* index every time it
  // changes (whether from auto-advance or a manual swipe), so a manual swipe
  // naturally resets the countdown instead of fighting a fixed interval.
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setTimeout(() => {
      const next = (activeIndex + 1) % slides.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setActiveIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, slides.length, width]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
  };

  if (slides.length === 0) return null;

  return (
    <View className="mb-6" onLayout={handleLayout}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <PromoCard slide={item} width={width} />
          </View>
        )}
      />
      {slides.length > 1 && (
        <View className="flex-row justify-center mt-3" style={{ gap: 6 }}>
          {slides.map((s, i) => (
            <View
              key={s.key}
              style={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
