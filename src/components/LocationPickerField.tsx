import { useState } from "react";
import { View, Pressable, Text, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { detectCurrentLocationLabel } from "../lib/locationPicker";
import { colors } from "../constants/theme";
import FieldInput from "./FieldInput";
import { getFriendlyErrorMessage } from "../lib/friendlyError";

export default function LocationPickerField({
  value,
  onChange,
  placeholder,
  variant,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // "card": slightly larger "Use my current location" link with a
  // navigation-arrow icon (used on Create Squad). Default is unchanged.
  variant?: "card";
}) {
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const label = await detectCurrentLocationLabel();
      onChange(label);
    } catch (err) {
      Alert.alert("Couldn't Detect Location", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View>
      <FieldInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? "e.g. DHA Phase 6, Lahore"}
        maxLength={120}
        containerStyle={{ gap: 8 }}
        right={
          <Pressable onPress={handleDetect} disabled={detecting} hitSlop={8}>
            {detecting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate-outline" size={20} color={colors.primary} />
            )}
          </Pressable>
        }
      />
      <Pressable
        onPress={handleDetect}
        disabled={detecting}
        className={variant === "card" ? "mt-3 self-start flex-row items-center" : "mt-1.5 self-start"}
        style={variant === "card" ? { gap: 8 } : undefined}
      >
        {variant === "card" ? <Ionicons name="navigate" size={16} color={colors.primary} /> : null}
        <Text
          className={variant === "card" ? "text-primary font-semibold" : "text-primary text-xs font-medium"}
          style={variant === "card" ? { fontSize: 14 } : undefined}
        >
          {detecting ? "Detecting your location..." : "Use my current location"}
        </Text>
      </Pressable>
    </View>
  );
}
