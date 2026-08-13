import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { View, TextInput } from "react-native";
import { colors } from "../constants/theme";

// Shared "appealing" text field: rounded, a soft border, and a green
// highlight (border + tint background) while focused — used in place of a
// plain `<TextInput className="border border-border rounded-xl ...">`
// wherever a form on this screen collects free text. `left`/`right` let a
// field carry an icon or a fixed prefix (e.g. "Rs") inside the same rounded
// container without breaking the focus-highlight behavior.
export default function FieldInput({
  containerStyle,
  containerClassName,
  left,
  right,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & {
  containerStyle?: object;
  containerClassName?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={
        containerClassName ??
        `flex-row rounded-2xl px-4 ${multiline ? "items-start py-1" : "items-center"}`
      }
      style={[
        {
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : colors.border,
          backgroundColor: focused ? colors.primaryLight : "white",
        },
        containerStyle,
      ]}
    >
      {left}
      <TextInput
        {...props}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={colors.muted}
        style={[{ paddingVertical: 12 }, props.style]}
        className={`flex-1 text-ink ${props.className ?? ""}`}
      />
      {right}
    </View>
  );
}
