import { colors } from "@app/constants/theme";

export default function Spinner({ size = 20, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin"
      role="status"
      aria-label="Loading"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
