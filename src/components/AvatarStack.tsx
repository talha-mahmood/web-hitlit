import { View, Text, Image } from "react-native";
import { colors } from "../constants/theme";

type Person = { avatar: string | null; name: string | null };

// Overlapping circular avatars (like "2 Going" on an event card) — up to
// `max` shown, with a "+N" bubble for the rest.
export default function AvatarStack({
  people,
  size = 24,
  max = 3,
}: {
  people: Person[];
  size?: number;
  max?: number;
}) {
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;

  return (
    <View className="flex-row items-center">
      {visible.map((p, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.35,
            zIndex: visible.length - i,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: "white",
            backgroundColor: colors.primaryLight,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {p.avatar ? (
            <Image source={{ uri: p.avatar }} style={{ width: size, height: size }} />
          ) : (
            <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: colors.primary }}>
              {(p.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{
            marginLeft: -size * 0.35,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: "white",
            backgroundColor: "#142533",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: size * 0.34, fontWeight: "700", color: colors.muted }}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}
