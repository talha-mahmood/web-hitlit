import type { ReactNode } from "react";
import { colors } from "@app/constants/theme";
import { Ionicon } from "../icons/Icon";

export type NewMatchSport = "padel" | "tennis" | "badminton" | "pickleball" | "tableTennis" | "football" | "cricket";

// Equipment drawings from the app's SportNewMatchHeader, redrawn as SVG.
function Racket({ x, frame, handle, w = 36, h = 44, rotate = -16 }: { x: number; frame: string; handle: string; w?: number; h?: number; rotate?: number }) {
  const cx = x + w / 2;
  return (
    <g transform={`rotate(${rotate} ${cx} 40)`}>
      <ellipse cx={cx} cy={4 + h / 2} rx={w / 2 - 1.5} ry={h / 2 - 1.5} fill="rgba(255,255,255,0.7)" stroke={frame} strokeWidth={3} />
      {[1, 2, 3].map((i) => (
        <line key={`v${i}`} x1={x + (w * i) / 4} y1={6} x2={x + (w * i) / 4} y2={2 + h} stroke={frame} strokeOpacity={0.45} />
      ))}
      {[1, 2, 3, 4].map((i) => (
        <line key={`h${i}`} x1={x + 3} y1={4 + (h * i) / 5} x2={x + w - 3} y2={4 + (h * i) / 5} stroke={frame} strokeOpacity={0.45} />
      ))}
      <rect x={cx - 1.5} y={4 + h} width={3} height={8} fill={frame} />
      <rect x={cx - 3} y={12 + h} width={6} height={22} rx={3} fill={handle} />
    </g>
  );
}

function Paddle({ x, w, h, r, face, rim, handle, holes, rotate = -16 }: { x: number; w: number; h: number; r: number; face: string; rim: string; handle: string; holes?: boolean; rotate?: number }) {
  const cx = x + w / 2;
  return (
    <g transform={`rotate(${rotate} ${cx} 40)`}>
      <rect x={x} y={4} width={w} height={h} rx={r} fill={face} stroke={rim} strokeWidth={2.5} />
      {holes &&
        Array.from({ length: 9 }, (_, i) => <circle key={i} cx={x + w / 2 + ((i % 3) - 1) * 9} cy={4 + h / 2 + (Math.floor(i / 3) - 1) * 9} r={2} fill="rgba(255,255,255,0.75)" />)}
      <rect x={cx - 4} y={3 + h} width={8} height={22} rx={3} fill={handle} />
    </g>
  );
}

const Ball = ({ cx, cy, r, fill, stroke, seam = true }: { cx: number; cy: number; r: number; fill: string; stroke: string; seam?: boolean }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} />
    {seam && <line x1={cx - r} y1={cy + 3} x2={cx + r} y2={cy - 3} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />}
  </g>
);

const ART: Record<NewMatchSport, () => ReactNode> = {
  // Cricket's own New Match header: three stumps with bails and a ball.
  cricket: () => (
    <>
      <rect x={17} y={-1} width={15} height={4} rx={2} fill="#C9A46B" />
      <rect x={31} y={-1} width={15} height={4} rx={2} fill="#C9A46B" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={16 + i * 14} y={4} width={7} height={62} rx={3} fill="#C9A46B" />
      ))}
      <g>
        <circle cx={61} cy={39} r={17} fill="#DC2626" stroke="#991B1B" />
        <line x1={44} y1={44} x2={78} y2={33} stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
      </g>
    </>
  ),
  padel: () => (
    <>
      <Paddle x={18} w={38} h={44} r={17} face="#1D4ED8" rim="#1E3A8A" handle="#0F172A" holes />
      <Ball cx={96} cy={52} r={12} fill="#FDE047" stroke="#CA8A04" />
    </>
  ),
  tennis: () => (
    <>
      <Racket x={16} frame="#0E5C34" handle="#1F2937" />
      <Ball cx={95} cy={51} r={13} fill="#D9F99D" stroke="#65A30D" />
    </>
  ),
  badminton: () => (
    <>
      <Racket x={14} w={30} h={40} frame="#BE185D" handle="#1F2937" rotate={-18} />
      <g transform="rotate(24 87 40)">
        <path d="M72 20 L102 20 L87 50 Z" fill="white" stroke="#F9A8D4" />
        <line x1={87} y1={26} x2={87} y2={48} stroke="rgba(190,24,93,0.35)" />
        <circle cx={87} cy={53} r={6.5} fill="#FBBF24" stroke="#B45309" />
      </g>
    </>
  ),
  pickleball: () => (
    <>
      <Paddle x={18} w={36} h={42} r={12} face="#7C3AED" rim="#5B21B6" handle="#1F2937" />
      <circle cx={95} cy={51} r={13} fill="#FDE047" stroke="#CA8A04" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={89 + (i % 3) * 6} cy={47 + Math.floor(i / 3) * 7} r={2} fill="rgba(146,64,14,0.55)" />
      ))}
    </>
  ),
  tableTennis: () => (
    <>
      <Paddle x={16} w={40} h={40} r={20} face="#DC2626" rim="#C9A46B" handle="#C9A46B" />
      <Ball cx={95} cy={53} r={9} fill="white" stroke="#D1D5DB" seam={false} />
    </>
  ),
  football: () => (
    <>
      <rect x={7} y={11} width={62} height={55} fill="rgba(255,255,255,0.35)" />
      {[1, 2, 3, 4].map((i) => (
        <line key={`v${i}`} x1={7 + (62 * i) / 5} y1={11} x2={7 + (62 * i) / 5} y2={66} stroke="rgba(255,255,255,0.8)" />
      ))}
      {[1, 2, 3].map((i) => (
        <line key={`h${i}`} x1={7} y1={11 + (55 * i) / 4} x2={69} y2={11 + (55 * i) / 4} stroke="rgba(255,255,255,0.8)" />
      ))}
      <rect x={4} y={8} width={68} height={5} rx={2.5} fill="#F8FAFC" stroke="rgba(15,23,42,0.18)" strokeWidth={0.5} />
      <rect x={4} y={8} width={5} height={58} rx={2.5} fill="#F8FAFC" stroke="rgba(15,23,42,0.18)" strokeWidth={0.5} />
      <rect x={67} y={8} width={5} height={58} rx={2.5} fill="#F8FAFC" stroke="rgba(15,23,42,0.18)" strokeWidth={0.5} />
      <ellipse cx={94} cy={65} rx={17} ry={3} fill="rgba(15,23,42,0.18)" />
      <circle cx={94} cy={46} r={17} fill="white" stroke="#111827" strokeWidth={1.5} />
      <polygon points="94,39 100,43.5 98,50.5 90,50.5 88,43.5" fill="#111827" />
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={94 + 15 * Math.sin(rad)} cy={46 - 15 * Math.cos(rad)} r={4.5} fill="#111827" />;
      })}
    </>
  ),
};

// Header for a sport's "New Match" page: soft circle top-right, green mound
// bottom-right with that sport's equipment standing on it.
export default function SportNewMatchHeader({ sport, title, subtitle, onBack }: { sport: NewMatchSport; title: string; subtitle: string; onBack: () => void }) {
  const Art = ART[sport];
  return (
    <div className="relative overflow-hidden pb-4 pt-[calc(env(safe-area-inset-top)+16px)] lg:rounded-3xl lg:pt-6">
      <span className="pointer-events-none absolute -right-[60px] -top-[110px] h-[220px] w-[220px] rounded-full bg-primary-light opacity-50" />
      <span className="pointer-events-none absolute -bottom-[230px] -right-[70px] h-[280px] w-[280px] rounded-full bg-[#4ADE80]" />
      <svg className="pointer-events-none absolute bottom-1.5 right-7" width={112} height={70} viewBox="0 0 112 70" aria-hidden>
        <Art />
      </svg>
      <div className="relative flex items-center gap-1.5 px-4 lg:px-0">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1 transition hover:bg-gray-100 active:scale-90">
          <Ionicon name="arrow-back" size={22} color={colors.ink} />
        </button>
        <div className="min-w-0 flex-1 pr-32">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
