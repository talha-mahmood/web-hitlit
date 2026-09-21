import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

export type NewMatchSport = "padel" | "tennis" | "badminton" | "pickleball" | "tableTennis" | "football";

// The two shapes behind the illustration, per sport — the same colours each
// sport already uses on its own match-list screen. (The screen background
// itself is the same bg-green-50 as the cricket New Match screen.)
const NEW_MATCH_THEME: Record<NewMatchSport, { blob: string; mound: string }> = {
  padel: { blob: "#DBEAFE", mound: "#60A5FA" },
  tennis: { blob: "#FEF3C7", mound: "#FBBF24" },
  badminton: { blob: "#FCE7F3", mound: "#F472B6" },
  pickleball: { blob: "#EDE9FE", mound: "#A78BFA" },
  tableTennis: { blob: "#FFEDD5", mound: "#FB923C" },
  football: { blob: "#DCFCE7", mound: "#4ADE80" },
};

// --- Small drawing helpers (plain Views, like the cricket stumps and ball) ---

function Ball({
  size,
  color,
  border,
  seam = true,
  style,
}: {
  size: number;
  color: string;
  border: string;
  seam?: boolean;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: border,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {seam ? (
        <View
          style={{
            position: "absolute",
            top: size / 2 - 1,
            left: -4,
            width: size + 8,
            height: 1.5,
            backgroundColor: "rgba(255,255,255,0.8)",
            transform: [{ rotate: "-18deg" }],
          }}
        />
      ) : null}
    </View>
  );
}

// Strung racket: oval frame, a light string grid, a throat and a handle.
function Racket({
  headW,
  headH,
  frame,
  handle,
  handleH = 24,
  rotate = "0deg",
  style,
}: {
  headW: number;
  headH: number;
  frame: string;
  handle: string;
  handleH?: number;
  rotate?: string;
  style?: object;
}) {
  return (
    <View style={[{ position: "absolute", alignItems: "center", transform: [{ rotate }] }, style]}>
      <View
        style={{
          width: headW,
          height: headH,
          borderRadius: headW / 2,
          borderWidth: 3,
          borderColor: frame,
          backgroundColor: "rgba(255,255,255,0.7)",
          overflow: "hidden",
        }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={`v${i}`}
            style={{ position: "absolute", top: 0, bottom: 0, left: (headW * i) / 4 - 3, width: 1, backgroundColor: frame, opacity: 0.45 }}
          />
        ))}
        {[1, 2, 3, 4].map((i) => (
          <View
            key={`h${i}`}
            style={{ position: "absolute", left: 0, right: 0, top: (headH * i) / 5 - 3, height: 1, backgroundColor: frame, opacity: 0.45 }}
          />
        ))}
      </View>
      <View style={{ width: 3, height: 8, backgroundColor: frame, marginTop: -1 }} />
      <View style={{ width: 6, height: handleH, borderRadius: 3, backgroundColor: handle }} />
    </View>
  );
}

// Solid paddle (padel / pickleball / table tennis): a rounded face and a handle.
function Paddle({
  faceW,
  faceH,
  radius,
  face,
  rim,
  handle,
  handleH = 22,
  holes = false,
  rotate = "0deg",
  style,
}: {
  faceW: number;
  faceH: number;
  radius: number;
  face: string;
  rim: string;
  handle: string;
  handleH?: number;
  holes?: boolean;
  rotate?: string;
  style?: object;
}) {
  return (
    <View style={[{ position: "absolute", alignItems: "center", transform: [{ rotate }] }, style]}>
      <View
        style={{
          width: faceW,
          height: faceH,
          borderRadius: radius,
          backgroundColor: face,
          borderWidth: 2.5,
          borderColor: rim,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 5,
          overflow: "hidden",
        }}
      >
        {holes
          ? Array.from({ length: 9 }, (_, i) => (
              <View
                key={i}
                style={{ width: 4, height: 4, borderRadius: 2, margin: 2.5, backgroundColor: "rgba(255,255,255,0.75)" }}
              />
            ))
          : null}
      </View>
      <View style={{ width: 8, height: handleH, borderRadius: 3, backgroundColor: handle, marginTop: -1 }} />
    </View>
  );
}

function FootballArt() {
  const post = "#F8FAFC";
  const edge = "rgba(15,23,42,0.18)";
  return (
    <>
      {/* Goal: crossbar, two posts and a light net. */}
      <View style={{ position: "absolute", left: 4, bottom: 0, width: 68, height: 58 }}>
        <View style={{ position: "absolute", left: 3, right: 3, top: 3, bottom: 0, backgroundColor: "rgba(255,255,255,0.35)" }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: (62 * i) / 5, width: 1, backgroundColor: "rgba(255,255,255,0.8)" }} />
          ))}
          {[1, 2, 3].map((i) => (
            <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: (55 * i) / 4, height: 1, backgroundColor: "rgba(255,255,255,0.8)" }} />
          ))}
        </View>
        <View style={{ position: "absolute", left: 0, top: 0, width: 68, height: 5, borderRadius: 2.5, backgroundColor: post, borderWidth: 0.5, borderColor: edge }} />
        <View style={{ position: "absolute", left: 0, top: 0, width: 5, height: 58, borderRadius: 2.5, backgroundColor: post, borderWidth: 0.5, borderColor: edge }} />
        <View style={{ position: "absolute", right: 0, top: 0, width: 5, height: 58, borderRadius: 2.5, backgroundColor: post, borderWidth: 0.5, borderColor: edge }} />
      </View>
      {/* Ball resting beside the goal. */}
      <Ball size={30} color="white" border="#94A3B8" seam={false} style={{ right: 0, bottom: 2 }} />
      <View style={{ position: "absolute", right: 10, bottom: 12, width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#1F2937" }} />
      <View style={{ position: "absolute", right: 3, bottom: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: "#1F2937" }} />
      <View style={{ position: "absolute", right: 22, bottom: 20, width: 6, height: 6, borderRadius: 3, backgroundColor: "#1F2937" }} />
    </>
  );
}

function PadelArt() {
  return (
    <>
      <Paddle faceW={38} faceH={44} radius={17} face="#1D4ED8" rim="#1E3A8A" handle="#0F172A" holes rotate="-16deg" style={{ left: 18, bottom: 0 }} />
      <Ball size={24} color="#FDE047" border="#CA8A04" style={{ right: 4, bottom: 2 }} />
    </>
  );
}

function TennisArt() {
  return (
    <>
      <Racket headW={36} headH={44} frame="#15803D" handle="#1F2937" handleH={22} rotate="-16deg" style={{ left: 16, bottom: 0 }} />
      <Ball size={26} color="#D9F99D" border="#65A30D" style={{ right: 4, bottom: 2 }} />
    </>
  );
}

function BadmintonArt() {
  return (
    <>
      <Racket headW={30} headH={40} frame="#BE185D" handle="#1F2937" handleH={24} rotate="-18deg" style={{ left: 14, bottom: 0 }} />
      {/* Shuttlecock: cork at the tip, a fan of feathers above it. */}
      <View style={{ position: "absolute", right: 8, bottom: 2, width: 34, height: 44, alignItems: "center", transform: [{ rotate: "24deg" }] }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 15,
            borderRightWidth: 15,
            borderTopWidth: 30,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: "white",
          }}
        />
        <View style={{ position: "absolute", top: 0, width: 30, height: 3, borderRadius: 1.5, backgroundColor: "#F9A8D4" }} />
        <View style={{ position: "absolute", top: 6, left: 15, width: 1, height: 22, backgroundColor: "rgba(190,24,93,0.35)" }} />
        <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: "#FBBF24", borderWidth: 1, borderColor: "#B45309", marginTop: -3 }} />
      </View>
    </>
  );
}

function PickleballArt() {
  return (
    <>
      <Paddle faceW={36} faceH={42} radius={12} face="#7C3AED" rim="#5B21B6" handle="#1F2937" rotate="-16deg" style={{ left: 18, bottom: 0 }} />
      {/* Perforated ball. */}
      <View
        style={{
          position: "absolute",
          right: 4,
          bottom: 2,
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: "#FDE047",
          borderWidth: 1,
          borderColor: "#CA8A04",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 4,
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: 4, height: 4, borderRadius: 2, margin: 1.5, backgroundColor: "rgba(146,64,14,0.55)" }} />
        ))}
      </View>
    </>
  );
}

function TableTennisArt() {
  return (
    <>
      <Paddle faceW={40} faceH={40} radius={20} face="#DC2626" rim="#C9A46B" handle="#C9A46B" handleH={20} rotate="-16deg" style={{ left: 16, bottom: 0 }} />
      <Ball size={18} color="white" border="#D1D5DB" seam={false} style={{ right: 8, bottom: 4 }} />
    </>
  );
}

const ART: Record<NewMatchSport, () => ReactNode> = {
  football: FootballArt,
  padel: PadelArt,
  tennis: TennisArt,
  badminton: BadmintonArt,
  pickleball: PickleballArt,
  tableTennis: TableTennisArt,
};

// Header for a sport's "New Match" screen — same layout as the cricket one: a
// soft circle at the top-right, a coloured mound rising from the bottom-right
// corner, and that sport's equipment standing on it.
export default function SportNewMatchHeader({
  sport,
  title,
  subtitle,
  onBack,
}: {
  sport: NewMatchSport;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = NEW_MATCH_THEME[sport];
  const Art = ART[sport];

  return (
    <View className="overflow-hidden" style={{ paddingTop: insets.top + 16, paddingBottom: 16 }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: theme.blob,
          opacity: 0.5,
          top: -110,
          right: -60,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: theme.mound,
          bottom: -230,
          right: -70,
        }}
      />
      <View pointerEvents="none" style={{ position: "absolute", right: 28, bottom: 6, width: 112, height: 66 }}>
        <Art />
      </View>

      <View className="flex-row items-center px-4" style={{ gap: 6 }}>
        <Pressable onPress={onBack} hitSlop={8} className="p-1">
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-ink">{title}</Text>
          <Text className="text-muted text-sm mt-0.5">{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
