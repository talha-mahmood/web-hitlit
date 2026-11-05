import { Pressable, Text, View } from "react-native";
import GradientFill from "./GradientFill";

type SportChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function SportChip({ label, selected, onPress }: SportChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border mr-2 ${selected ? "border-primary" : "border-border"}`}
    >
      {selected ? (
        <GradientFill className="px-4 py-2 rounded-full">
          <Text className="text-jazba-white font-semibold">{label}</Text>
        </GradientFill>
      ) : (
        <View className="px-4 py-2 rounded-full bg-surface">
          <Text className="text-ink">{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
