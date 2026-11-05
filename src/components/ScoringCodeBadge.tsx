import { useState } from "react";
import { Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors } from "../constants/theme";

// Shown at the top of every sport's Live Scoring screen once a match
// exists — lets the host copy the match's scoring_code (see "View Scoring"
// on that sport's home screen) to share with anyone who wants to watch
// without being a player.
export default function ScoringCodeBadge({
  code,
  variant = "light",
}: {
  code: string | null | undefined;
  // "dark" sits on a dark-green header (cricket); "light" sits on a white
  // header (every other sport's Live Scoring screen).
  variant?: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isDark = variant === "dark";

  return (
    <Pressable
      onPress={handleCopy}
      hitSlop={6}
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 5,
        backgroundColor: isDark ? "rgba(255,255,255,0.16)" : "#142533",
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.3)" : colors.border,
      }}
    >
      <Text
        style={{
          color: isDark ? "white" : colors.ink,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 1,
        }}
      >
        {code}
      </Text>
      <Ionicons
        name={copied ? "checkmark" : "copy-outline"}
        size={13}
        color={isDark ? "white" : colors.muted}
      />
    </Pressable>
  );
}
