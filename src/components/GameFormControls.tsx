import { View, Text } from "react-native";
import Bouncy from "./Bouncy";
import { colors, fonts } from "../constants/theme";

export function SectionLabel({ title, required }: { title: string; required?: boolean }) {
  return (
    <View className="flex-row items-center mb-2 mt-5">
      <Text style={{ fontFamily: fonts.bold }} className="text-ink text-sm">
        {title}
      </Text>
      {required && <Text className="text-red-500 ml-1">*</Text>}
    </View>
  );
}

export function PillRow<T extends string>({
  options,
  value,
  onChange,
  color = colors.primary,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <Bouncy
            key={o.value}
            onPress={() => onChange(o.value)}
            className="rounded-2xl"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: selected ? color : "white",
              borderWidth: 1.5,
              borderColor: selected ? color : colors.border,
              ...(selected
                ? {
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.22,
                    shadowRadius: 8,
                    elevation: 3,
                  }
                : null),
            }}
          >
            <Text
              style={{ fontFamily: fonts.semibold }}
              className={`text-sm ${selected ? "text-white" : "text-ink"}`}
            >
              {o.label}
            </Text>
          </Bouncy>
        );
      })}
    </View>
  );
}
