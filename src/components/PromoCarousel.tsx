import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  type ImageSourcePropType,
  Dimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Image from "./images/OptimizedImage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../constants/theme";
import GradientFill from "./GradientFill";

export type PromoSlide = {
  key: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  // Optional real gradient for the card background — when given, this
  // renders instead of the flat `bgColor` fill (bgColor is still used as a
  // plain reference color for text/icon contrast on top of accentColor).
  bgGradient?: readonly [string, string, ...string[]];
  accentColor: string;
  // When set, the slide is just this picture, edge to edge (it carries its
  // own design), instead of the generated title/subtitle/CTA card — the
  // text fields above are then unused. The slide is only tappable if
  // onPress is given.
  image?: ImageSourcePropType;
  onPress?: () => void;
};

// Fallback estimate used only until the container's real width is measured
// via onLayout (below) — avoids a zero-width flash on first paint. The real
// width is whatever the parent gives this component (full column width,
// screen-edge-to-edge, etc.), so this component makes no assumption about
// its own placement/padding.
const FALLBACK_WIDTH = Dimensions.get("window").width - 28;
const CARD_HEIGHT = 132;
const AUTO_ADVANCE_MS = 4500;

function PromoCard({ slide, width }: { slide: PromoSlide; width: number }) {
  if (slide.image) {
    return (
      <Pressable
        onPress={slide.onPress}
        disabled={!slide.onPress}
        accessibilityLabel={slide.title}
        style={{ width, height: CARD_HEIGHT }}
        className="rounded-3xl overflow-hidden"
      >
        <Image source={slide.image} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={slide.onPress} style={{ width, height: CARD_HEIGHT }}>
      <LinearGradient
        colors={slide.bgGradient ?? [slide.bgColor, slide.bgColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width, height: CARD_HEIGHT }}
        className="rounded-3xl overflow-hidden px-5 py-4 justify-between"
      >
      {/* Soft translucent "glow" shapes layer on top of the background for
          extra depth. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 185,
          height: 185,
          borderRadius: 93,
          backgroundColor: slide.accentColor,
          opacity: 0.16,
          top: -70,
          right: -55,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 115,
          height: 115,
          borderRadius: 58,
          backgroundColor: slide.accentColor,
          opacity: 0.1,
          bottom: -46,
          left: -30,
        }}
      />
      <Ionicons
        name={slide.icon}
        size={80}
        color={slide.accentColor}
        style={{ position: "absolute", right: -5, bottom: -11, opacity: 0.16 }}
      />

      <View style={{ maxWidth: "76%" }}>
        <Text
          style={{ color: slide.accentColor, letterSpacing: 1.2 }}
          className="text-[10px] font-bold uppercase mb-1"
        >
          HitLit
        </Text>
        <Text className="text-jazba-white text-lg font-extrabold leading-5" numberOfLines={2}>
          {slide.title}
        </Text>
        <Text className="text-jazba-white text-xs mt-1 opacity-80" numberOfLines={2}>
          {slide.subtitle}
        </Text>
      </View>

      <View
        className="flex-row items-center self-start rounded-full px-3.5 py-1.5"
        style={{ backgroundColor: slide.accentColor, gap: 5 }}
      >
        <Text className="text-xs font-bold" style={{ color: slide.bgColor }}>
          {slide.cta}
        </Text>
        <Ionicons name="arrow-forward" size={12} color={slide.bgColor} />
      </View>
      </LinearGradient>
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
    <View className="mb-4" onLayout={handleLayout}>
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
        <View className="flex-row justify-center mt-2" style={{ gap: 5 }}>
          {slides.map((s, i) =>
            i === activeIndex ? (
              <GradientFill key={s.key} style={{ width: 18, height: 6, borderRadius: 3 }} />
            ) : (
              <View key={s.key} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border }} />
            )
          )}
        </View>
      )}
    </View>
  );
}
