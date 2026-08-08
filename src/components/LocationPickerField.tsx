import { useState } from "react";
import { View, TextInput, Pressable, Text, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { detectCurrentLocationLabel } from "../lib/locationPicker";
import { colors } from "../constants/theme";

export default function LocationPickerField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const label = await detectCurrentLocationLabel();
      onChange(label);
    } catch (err) {
      Alert.alert("Couldn't Detect Location", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center border border-border rounded-xl px-4" style={{ gap: 8 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? "e.g. DHA Phase 6, Lahore"}
          className="flex-1 py-3 text-ink"
          maxLength={120}
        />
        <Pressable onPress={handleDetect} disabled={detecting} hitSlop={8}>
          {detecting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={20} color={colors.primary} />
          )}
        </Pressable>
      </View>
      <Pressable onPress={handleDetect} disabled={detecting} className="mt-1.5 self-start">
        <Text className="text-primary text-xs font-medium">
          {detecting ? "Detecting your location..." : "Use my current location"}
        </Text>
      </Pressable>
    </View>
  );
}
