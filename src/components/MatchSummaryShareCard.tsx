import { forwardRef } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polygon } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

// Captured off-screen by react-native-view-shot and shared as a PNG (see
// handleShareMatchSummary in LiveScoringScreen) — built at a fixed design
// width, same idea as CommunityBanner's BASE_W canvas, since this view is
// never actually shown on screen at phone width, just rasterized.
const CARD_W = 1080;

const NAVY_DARK = "#0E2229";
const NAVY = "#123036";
const TEAL = "#3FD0BE";
const TEAL_SOFT = "#9FD9CE";
const MUTED = "#8FA7AE";

export type ShareCardStat = { name: string; statLabel: string };
export type ShareCardInningsEntry = {
  teamName: string;
  score: string; // "266-11"
  oversLabel: string; // "19.2"
  topBatters: ShareCardStat[];
  topBowlers: ShareCardStat[];
};
export type MatchSummaryShareCardProps = {
  scoringCode: string;
  innings: ShareCardInningsEntry[];
  resultSummary: string;
  playerOfTheMatch: string | null;
  dateLabel: string;
};

// Two overlapping diagonal bands in the top-right corner, behind the
// branding text — approximates the reference design's geometric accent
// without needing exact original coordinates.
function CornerAccent() {
  return (
    <Svg
      width={560}
      height={260}
      viewBox="0 0 560 260"
      style={{ position: "absolute", top: 0, right: 0 }}
    >
      <Polygon points="180,0 560,0 560,170 60,260" fill="rgba(255,255,255,0.08)" />
      <Polygon points="320,0 560,0 560,110 230,220" fill="#1C5A52" />
    </Svg>
  );
}

function TeamSection({ entry }: { entry: ShareCardInningsEntry }) {
  const rowCount = Math.max(entry.topBatters.length, entry.topBowlers.length);
  return (
    <View style={{ marginTop: 32 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 18 }}>
        <Text
          style={{ flex: 1, color: TEAL, fontSize: 32, fontWeight: "800", letterSpacing: 0.5 }}
          numberOfLines={1}
        >
          {entry.teamName.toUpperCase()}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", marginRight: 36 }}>
          <Text style={{ color: TEAL_SOFT, fontSize: 18, fontWeight: "600", marginRight: 8 }}>Overs</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>{entry.oversLabel}</Text>
        </View>
        <Text style={{ color: "#FFFFFF", fontSize: 42, fontWeight: "800" }}>{entry.score}</Text>
      </View>
      {Array.from({ length: rowCount }, (_, i) => {
        const batter = entry.topBatters[i];
        const bowler = entry.topBowlers[i];
        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 6,
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginBottom: 6,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between", paddingRight: 20 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "600" }} numberOfLines={1}>
                {batter?.name ?? ""}
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "700" }}>{batter?.statLabel ?? ""}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "600" }} numberOfLines={1}>
                {bowler?.name ?? ""}
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "700" }}>{bowler?.statLabel ?? ""}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MatchSummaryShareCard = forwardRef<View, MatchSummaryShareCardProps>(function MatchSummaryShareCard(
  { scoringCode, innings, resultSummary, playerOfTheMatch, dateLabel },
  ref
) {
  return (
    <View ref={ref} collapsable={false} style={{ width: CARD_W, borderRadius: 36, overflow: "hidden" }}>
      <LinearGradient colors={[NAVY_DARK, "#1B4A4A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={{ paddingHorizontal: 48, paddingTop: 44, paddingBottom: 8 }}>
          <CornerAccent />
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "#E7EEF0", fontSize: 40, fontWeight: "800" }}>SUMMARY</Text>
              <Text style={{ color: MUTED, fontSize: 15, fontWeight: "600", marginTop: 4 }}>#{scoringCode}</Text>
            </View>
            <Text style={{ color: "#D8F3EC", fontSize: 17, fontWeight: "800", letterSpacing: 6, marginTop: 8 }}>
              HITLIT
            </Text>
          </View>

          {innings.map((entry, i) => (
            <TeamSection key={i} entry={entry} />
          ))}
        </View>

        <LinearGradient
          colors={["#2FB8A6", "#1C6E66"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ marginTop: 28, paddingVertical: 26, alignItems: "center" }}
        >
          <Text style={{ color: "#0B2420", fontSize: 26, fontWeight: "800", textAlign: "center", paddingHorizontal: 40 }}>
            {resultSummary}
          </Text>
        </LinearGradient>

        <View
          style={{
            backgroundColor: NAVY,
            paddingVertical: 24,
            paddingHorizontal: 40,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: MUTED, fontSize: 15 }}>{dateLabel}</Text>
          {playerOfTheMatch ? (
            <View
              style={{
                backgroundColor: "rgba(63,208,190,0.18)",
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 28,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "700" }} numberOfLines={1}>
                {playerOfTheMatch}
              </Text>
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Player of the match</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: TEAL, fontSize: 17, fontWeight: "800", marginRight: 4 }}>HitLit</Text>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="logo-google-playstore" size={17} color="#FFFFFF" />
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="logo-apple" size={19} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

export default MatchSummaryShareCard;
