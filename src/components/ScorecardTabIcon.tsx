import Svg, { Rect, Path } from "react-native-svg";

// The Scorecard tab icon from assets/Scorecard-svg-icon.svg (a rounded square
// with three text lines), redrawn with react-native-svg so it takes the tab
// bar's active/inactive colour and size like the other tab icons do.
export default function ScorecardTabIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect width={18} height={18} x={3} y={3} rx={2} />
      <Path d="M7 8h8" />
      <Path d="M7 12h10" />
      <Path d="M7 16h6" />
    </Svg>
  );
}
