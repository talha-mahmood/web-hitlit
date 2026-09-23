import Svg, { Path } from "react-native-svg";

// A gentle S-curve that sits at the bottom edge of a colored panel (a dark
// hero header, a team card's colored header strip) and fills with whatever
// color comes next — gives the hard rectangle edge a soft "wave" transition
// instead of a straight cut. `preserveAspectRatio="none"` stretches it to
// fill the parent's width exactly, so it works at any card width.
export default function WaveDivider({
  color,
  height = 28,
}: {
  color: string;
  height?: number;
}) {
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 400 40"
      preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: -1 }}
    >
      <Path d="M0,18 C100,-6 300,42 400,16 L400,40 L0,40 Z" fill={color} />
    </Svg>
  );
}
