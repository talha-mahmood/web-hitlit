import { colors } from "@app/constants/theme";
import { getSportImage } from "@app/lib/sportImages";
import { getSportIcon } from "@app/lib/sportIcons";
import { imageUrl } from "@/lib/cn";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import { useAppNavigate } from "@/routes/navigation";
import { paths, type MatchSport } from "@/routes/paths";

// Pastel disc behind each sport's photo.
const SPORT_DISC: Record<string, string> = {
  cricket: "#DCF5E4",
  padel: "#FEF3D6",
  football: "#E0ECFB",
  badminton: "#DDF4E6",
  pickleball: "#EAE6F8",
  tennis: "#FCE8EA",
  "table tennis": "#DCE9FA",
};

const SPORTS: { sportName: string; slug: MatchSport; title: string; subtitle: string }[] = [
  { sportName: "cricket", slug: "cricket", title: "Cricket", subtitle: "Ball-by-ball scoring with full innings & wickets" },
  { sportName: "padel", slug: "padel", title: "Padel", subtitle: "Points, games & sets — FIP scoring rules" },
  { sportName: "football", slug: "football", title: "Football", subtitle: "Live match clock, halves, extra time & penalties" },
  { sportName: "badminton", slug: "badminton", title: "Badminton", subtitle: "Rally scoring to 21, with the 29-29 golden point rule" },
  { sportName: "pickleball", slug: "pickleball", title: "Pickleball", subtitle: "Side-out or rally scoring, singles & doubles" },
  { sportName: "tennis", slug: "tennis", title: "Tennis", subtitle: "Points, games & sets with game/break/set/match point" },
  { sportName: "table tennis", slug: "table_tennis", title: "Table Tennis", subtitle: "11-point games, best of 5 or 7" },
];

function SportCard({ sportName, title, subtitle, onPress }: { sportName: string; title: string; subtitle: string; onPress: () => void }) {
  const photo = imageUrl(getSportImage(sportName));
  const { icon, bg, fg } = getSportIcon(sportName);
  return (
    <button
      type="button"
      onClick={onPress}
      className="group flex w-full items-center gap-2.5 rounded-3xl border-[1.5px] border-transparent bg-surface p-[9px] text-left shadow-card transition hover:border-primary hover:bg-gradient-to-br hover:from-[#D1F5DD] hover:to-green-50 active:scale-[0.97]"
    >
      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: SPORT_DISC[sportName] ?? bg }}>
        {photo ? <img src={photo} alt="" className="h-10 w-[72px] object-contain mix-blend-multiply" /> : <MCIcon name={icon} size={26} color={fg} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[15px] text-muted">{subtitle}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F3F5] transition group-hover:bg-brand group-hover:shadow-cta">
        <Ionicon name="chevron-forward" size={15} color={colors.muted} className="group-hover:hidden" />
        <Ionicon name="chevron-forward" size={15} color="white" className="hidden group-hover:block" />
      </span>
    </button>
  );
}

// Scoreboard-and-trophy mascot with the "Keep Score Keep Playing" tagline.
function HeaderArt() {
  return (
    <div className="pointer-events-none flex items-center gap-1">
      <svg width={52} height={72} viewBox="0 0 52 72" aria-hidden>
        <rect x={6} y={2} width={40} height={28} rx={6} fill="#6FC694" />
        <rect x={10} y={6} width={32} height={20} rx={4} fill="#CBEEDA" stroke="#1D9254" strokeWidth={1} />
        <text x={26} y={21} fontSize={12} fontWeight="bold" fill="#0E5C34" textAnchor="middle">
          0-0
        </text>
        <rect x={13} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        <rect x={35} y={30} width={4} height={10} rx={2} fill="#6FC694" />
        <path d="M14 42h24v6c0 8-5 12-12 12s-12-4-12-12z" fill="#9FDBB8" stroke="#1D9254" strokeWidth={1} />
        <path d="M14 44c-6 0-8 3-6 7 1 2 4 3 7 3M38 44c6 0 8 3 6 7-1 2-4 3-7 3" fill="none" stroke="#1D9254" strokeWidth={1.5} />
        <rect x={23} y={60} width={6} height={5} fill="#6FC694" />
        <rect x={16} y={65} width={20} height={5} rx={2} fill="#6FC694" />
        <circle cx={8} cy={66} r={4.5} fill="#CBEEDA" stroke="#1D9254" strokeWidth={1} />
      </svg>
      <div>
        <p className="whitespace-pre-line text-[13px] font-bold italic leading-[17px] text-white">{"Keep\nScore\nKeep Playing"}</p>
        <svg width={70} height={8} viewBox="0 0 70 8" aria-hidden>
          <path d="M2 5c14-4 34-4 60-1" fill="none" stroke="#8FD9AE" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// Port of ScorecardHomeScreen: the seven scorecard sports.
export default function ScorecardHomePage() {
  const navigate = useAppNavigate();
  return (
    <div className="mx-auto max-w-5xl lg:px-8 lg:pt-6">
      <header className="relative overflow-hidden rounded-b-[32px] bg-brand px-3.5 pb-5 pt-[calc(env(safe-area-inset-top)+12px)] lg:rounded-[28px] lg:px-7 lg:py-7">
        <div className="absolute bottom-5 right-3 top-[calc(env(safe-area-inset-top)+12px)] flex items-center lg:bottom-0 lg:right-8 lg:top-0">
          <HeaderArt />
        </div>
        <div className="flex items-center gap-2 pr-[130px]">
          <button type="button" onClick={() => navigate(paths.home)} aria-label="Back to Home" className="rounded-full p-0.5 hover:bg-white/10 lg:hidden">
            <Ionicon name="arrow-back" size={22} color="white" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-white lg:text-[28px]">Scorecard</h1>
            <p className="mt-0.5 truncate text-[13px] text-white">Live score your game</p>
          </div>
        </div>
      </header>

      <div className="grid gap-2.5 px-4 pb-6 pt-3.5 md:grid-cols-2 lg:px-0 lg:pt-6 xl:grid-cols-3">
        {SPORTS.map((s) => (
          <SportCard key={s.slug} sportName={s.sportName} title={s.title} subtitle={s.subtitle} onPress={() => navigate(`${paths.scorecard}/${s.slug}`)} />
        ))}
      </div>
    </div>
  );
}
