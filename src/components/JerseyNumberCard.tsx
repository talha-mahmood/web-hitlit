import { View, Text } from "react-native";

// Plain text, not a card — same "Jersey No." + giant background numeral
// layout as the reference design, recolored into the brand green family:
// the label a solid dark green, the oversized number a lighter green tint
// sitting behind it.
export default function JerseyNumberCard({ number }: { number: number }) {
  return (
    <View className="mt-4" style={{ height: 108, justifyContent: "center" }}>
      <Text
        className="font-extrabold"
        numberOfLines={1}
        style={{
          position: "absolute",
          right: 8,
          top: -16,
          fontSize: 130,
          lineHeight: 130,
          color: "#8FD9AE",
        }}
      >
        {number}
      </Text>
      <Text className="font-extrabold" style={{ fontSize: 28, color: "#18C66A" }}>
        Jersey No.
      </Text>
    </View>
  );
}
