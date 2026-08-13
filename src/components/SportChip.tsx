import { Pressable, Text } from "react-native";

type SportChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function SportChip({ label, selected, onPress }: SportChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full border mr-2 ${
        selected ? "bg-primary border-primary" : "bg-white border-border"
      }`}
    >
      <Text className={selected ? "text-white font-semibold" : "text-ink"}>{label}</Text>
    </Pressable>
  );
}
