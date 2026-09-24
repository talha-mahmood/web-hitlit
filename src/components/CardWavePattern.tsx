import Svg, { Path } from "react-native-svg";

// A soft, flowing wave-line texture drawn across a card's background —
// purely decorative. Put it as the first child of a `position: "relative",
// overflow: "hidden"` card, before the real content, so it sits behind
// everything else in the card.
export default function CardWavePattern({
  color,
  opacity = 0.1,
}: {
  color: string;
  opacity?: number;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Path
        d="M-20,50 C40,10 90,90 160,55 C230,20 270,70 330,40"
        stroke={color}
        strokeWidth={10}
        fill="none"
        opacity={opacity}
        strokeLinecap="round"
      />
      <Path
        d="M-30,120 C50,80 110,170 190,120 C260,80 300,140 340,110"
        stroke={color}
        strokeWidth={14}
        fill="none"
        opacity={opacity * 0.75}
        strokeLinecap="round"
      />
      <Path
        d="M-20,190 C60,150 130,220 210,180 C270,150 300,190 330,170"
        stroke={color}
        strokeWidth={10}
        fill="none"
        opacity={opacity * 0.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
