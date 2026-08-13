import { View, Text } from "react-native";
import { colors } from "../constants/theme";
import Bouncy from "./Bouncy";

export function SectionLabel({ title, required }: { title: string; required?: boolean }) {
  return (
    <View className="flex-row items-center mb-2 mt-5">
      <Text className="text-ink font-semibold text-sm">{title}</Text>
      {required && <Text className="text-red-500 ml-1">*</Text>}
    </View>
  );
}

export function PillRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <Bouncy
            key={o.value}
            onPress={() => onChange(o.value)}
            scaleTo={0.94}
            className="px-4 py-2.5 rounded-2xl"
            style={{
              borderWidth: 1.5,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? colors.primary : "white",
              ...(selected
                ? {
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    elevation: 2,
                  }
                : null),
            }}
          >
            <Text className={`text-sm font-medium ${selected ? "text-white" : "text-ink"}`}>
              {o.label}
            </Text>
          </Bouncy>
        );
      })}
    </View>
  );
}
