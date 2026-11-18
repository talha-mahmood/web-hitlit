import { lazy, type ComponentType } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { isMatchSport } from "@/lib/racketSports";
import { paths, type MatchSport } from "@/routes/paths";

// Each page loads on first visit (its own chunk).
const ScorecardHomePage = lazy(() => import("./ScorecardHomePage"));
const ManualScorePage = lazy(() => import("./ManualScorePage"));
const RacketHomePage = lazy(() => import("./RacketHomePage"));
const CricketHomePage = lazy(() => import("./RacketHomePage").then((m) => ({ default: m.CricketHomePage })));
const FootballHomePage = lazy(() => import("./RacketHomePage").then((m) => ({ default: m.FootballHomePage })));
const CricketNewMatchPage = lazy(() => import("./cricket/CricketNewMatchPage"));
const CricketLivePage = lazy(() => import("./cricket/CricketLivePage"));
const FootballLivePage = lazy(() => import("./Football").then((m) => ({ default: m.FootballLivePage })));
const FootballNewMatchPage = lazy(() => import("./Football").then((m) => ({ default: m.FootballNewMatchPage })));
const PadelLivePage = lazy(() => import("./racket/Padel").then((m) => ({ default: m.PadelLivePage })));
const PadelNewMatchPage = lazy(() => import("./racket/Padel").then((m) => ({ default: m.PadelNewMatchPage })));
const TennisLivePage = lazy(() => import("./racket/Tennis").then((m) => ({ default: m.TennisLivePage })));
const TennisNewMatchPage = lazy(() => import("./racket/Tennis").then((m) => ({ default: m.TennisNewMatchPage })));
const PickleballLivePage = lazy(() => import("./racket/Pickleball").then((m) => ({ default: m.PickleballLivePage })));
const PickleballNewMatchPage = lazy(() => import("./racket/Pickleball").then((m) => ({ default: m.PickleballNewMatchPage })));
const BadmintonLivePage = lazy(() => import("./racket/Badminton").then((m) => ({ default: m.BadmintonLivePage })));
const BadmintonNewMatchPage = lazy(() => import("./racket/Badminton").then((m) => ({ default: m.BadmintonNewMatchPage })));
const TableTennisLivePage = lazy(() => import("./racket/TableTennis").then((m) => ({ default: m.TableTennisLivePage })));
const TableTennisNewMatchPage = lazy(() => import("./racket/TableTennis").then((m) => ({ default: m.TableTennisNewMatchPage })));

type SportPages = { home: ComponentType; newMatch: ComponentType; live: ComponentType };

const SPORT_PAGES: Record<MatchSport, SportPages> = {
  padel: { home: RacketHomePage, newMatch: PadelNewMatchPage, live: PadelLivePage },
  tennis: { home: RacketHomePage, newMatch: TennisNewMatchPage, live: TennisLivePage },
  pickleball: { home: RacketHomePage, newMatch: PickleballNewMatchPage, live: PickleballLivePage },
  badminton: { home: RacketHomePage, newMatch: BadmintonNewMatchPage, live: BadmintonLivePage },
  table_tennis: { home: RacketHomePage, newMatch: TableTennisNewMatchPage, live: TableTennisLivePage },
  football: { home: FootballHomePage, newMatch: FootballNewMatchPage, live: FootballLivePage },
  cricket: { home: CricketHomePage, newMatch: CricketNewMatchPage, live: CricketLivePage },
};

function SportPage({ kind }: { kind: keyof SportPages }) {
  const { sport, matchId } = useParams();
  if (!isMatchSport(sport)) return <Navigate to={paths.scorecard} replace />;
  const Page = SPORT_PAGES[sport][kind];
  // Keyed so switching sport/match remounts with fresh state.
  return <Page key={`${sport}:${matchId ?? ""}`} />;
}

// /scorecard/* — hub, manual score, each sport's list and New Match.
export function ScorecardRoutes() {
  return (
    <Routes>
      <Route index element={<ScorecardHomePage />} />
      <Route path="manual" element={<ManualScorePage />} />
      <Route path=":sport" element={<SportPage kind="home" />} />
      <Route path=":sport/new" element={<SportPage kind="newMatch" />} />
      <Route path="*" element={<Navigate to={paths.scorecard} replace />} />
    </Routes>
  );
}

// /matches/:sport/:matchId — a match's live scoring / final view.
export function MatchRoutes() {
  return (
    <Routes>
      <Route path=":sport/:matchId" element={<SportPage kind="live" />} />
      <Route path="*" element={<Navigate to={paths.scorecard} replace />} />
    </Routes>
  );
}
