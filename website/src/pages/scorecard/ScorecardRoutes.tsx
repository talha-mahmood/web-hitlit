import type { JSX } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { isMatchSport } from "@/lib/racketSports";
import { paths, type MatchSport } from "@/routes/paths";
import ScorecardHomePage from "./ScorecardHomePage";
import ManualScorePage from "./ManualScorePage";
import RacketHomePage, { CricketHomePage, FootballHomePage } from "./RacketHomePage";
import CricketNewMatchPage from "./cricket/CricketNewMatchPage";
import CricketLivePage from "./cricket/CricketLivePage";
import { FootballLivePage, FootballNewMatchPage } from "./Football";
import { PadelLivePage, PadelNewMatchPage } from "./racket/Padel";
import { TennisLivePage, TennisNewMatchPage } from "./racket/Tennis";
import { PickleballLivePage, PickleballNewMatchPage } from "./racket/Pickleball";
import { BadmintonLivePage, BadmintonNewMatchPage } from "./racket/Badminton";
import { TableTennisLivePage, TableTennisNewMatchPage } from "./racket/TableTennis";

type SportPages = { home: () => JSX.Element; newMatch: () => JSX.Element; live: () => JSX.Element };

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
