import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// The "PlayOye Community" banner at the top of My Community. Laid out on a
// 361 x 103 design canvas that is scaled down on narrower phones, so the
// text, glass sport badges and tagline keep their proportions.
const BASE_W = 361;
const BASE_H = 103;

function GlassBadge({
  icon,
  size,
  right,
  top,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  size: number;
  right: number;
  top: number;
}) {
  return (
    <View
      pointerEvents="none"
      className="items-center justify-center"
      style={{
        position: "absolute",
        right,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.38)",
      }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.6} color="white" />
    </View>
  );
}

function DotGrid({ left, top }: { left: number; top: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top, width: 40, height: 28 }}>
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <View
            key={`${row}-${col}`}
            style={{
              position: "absolute",
              left: col * 12.6,
              top: row * 12.6,
              width: 2.6,
              height: 2.6,
              borderRadius: 1.3,
              backgroundColor: "rgba(255,255,255,0.22)",
            }}
          />
        ))
      )}
    </View>
  );
}

export default function CommunityBanner({ width }: { width: number }) {
  const k = Math.min(1, width / BASE_W);
  const height = BASE_H * k;
  const innerW = width / k;

  return (
    <View style={{ width, height, borderRadius: 20, overflow: "hidden" }}>
      <LinearGradient
        colors={["#0B6E3F", "#12924E", "#1BAA5A"]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: innerW,
          height: BASE_H,
          transformOrigin: "left top",
          transform: [{ scale: k }],
        }}
      >
        {/* Soft waves */}
        <Svg
          width={innerW}
          height={BASE_H}
          viewBox={`0 0 ${innerW} ${BASE_H}`}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <Path
            d={`M ${innerW - 220} ${BASE_H} C ${innerW - 185} 72, ${innerW - 145} 66, ${innerW - 98} 48 C ${innerW - 62} 36, ${innerW - 30} 52, ${innerW} 58 L ${innerW} ${BASE_H} Z`}
            fill="rgba(255,255,255,0.12)"
          />
          <Path
            d={`M ${innerW - 100} ${BASE_H} C ${innerW - 70} 82, ${innerW - 30} 70, ${innerW} 68 L ${innerW} ${BASE_H} Z`}
            fill="rgba(0,50,25,0.14)"
          />
        </Svg>
        <DotGrid left={innerW - 133} top={13} />
        <DotGrid left={innerW - 172} top={82} />

        {/* Text + button */}
        <Text
          style={{
            position: "absolute",
            left: 17,
            top: 14,
            fontSize: 22,
            lineHeight: 27,
            fontStyle: "italic",
            fontWeight: "800",
            color: "white",
            letterSpacing: -0.3,
          }}
        >
          PlayOye Community
        </Text>
        <Text style={{ position: "absolute", left: 17, top: 43, fontSize: 11.5, lineHeight: 15, color: "#D3F6E0" }}>
          {"Create Join Explore\nSquads & Games!"}
        </Text>

        {/* Sport badges */}
        <GlassBadge icon="soccer" size={34} right={innerW - 247} top={48} />
        <GlassBadge icon="tennis" size={35} right={innerW - 292} top={33} />
        <GlassBadge icon="cricket" size={36} right={12} top={52} />

        {/* Tagline */}
        <View pointerEvents="none" style={{ position: "absolute", right: 9, top: 8, transform: [{ rotate: "-9deg" }] }}>
          <Text style={{ fontSize: 12, lineHeight: 13.5, fontStyle: "italic", fontWeight: "700", color: "#86EFAC" }}>
            {"More\nSports\nMore Friends"}
          </Text>
          <Svg width={62} height={6} viewBox="0 0 62 6" style={{ marginTop: 0 }}>
            <Path d="M2 4c14-3 32-4 56-1" fill="none" stroke="#86EFAC" strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </View>
        {[
          { right: 84, top: 20, rotate: "-70deg", w: 6 },
          { right: 80, top: 28, rotate: "-38deg", w: 8 },
          { right: 80, top: 38, rotate: "0deg", w: 7 },
        ].map((p, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              right: p.right,
              top: p.top,
              width: p.w,
              height: 1.6,
              borderRadius: 1,
              backgroundColor: "#86EFAC",
              transform: [{ rotate: p.rotate }],
            }}
          />
        ))}
      </View>
    </View>
  );
}
