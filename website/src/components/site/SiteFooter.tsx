import { Link } from "react-router";
import { Ionicon } from "@/components/icons/Icon";
import { paths } from "@/routes/paths";
import { ACCOUNT_LINKS, COMMUNITY_LINKS, PLAY_LINKS, type NavLink } from "./nav";

export const SUPPORT_MAILTO = "mailto:mahmoodhamza1261@gmail.com?subject=HitLit%20Support";

function Column({ title, links }: { title: string; links: Pick<NavLink, "label" | "to">[] }) {
  return (
    <div>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-white/50">{title}</h2>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-sm text-white/75 transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Site footer on the app's dark-green brand (#14532D family). `signedIn`
// adds the account column; the public pages get a shorter version.
export default function SiteFooter({ signedIn = true }: { signedIn?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-[#062A19] text-white">
      <div className="site-container py-12 lg:py-14">
        <div className={`grid gap-10 sm:grid-cols-2 ${signedIn ? "lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]" : "lg:grid-cols-[2fr_1fr]"}`}>
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" className="h-9 w-9" />
              <span className="text-xl font-extrabold tracking-tight">
                Hit<span className="text-[#4ADE80]">Lit</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Your city's sports community in one place: find players and squads, join games and tournaments, discover venues and keep live scorecards.
            </p>
            <a href={SUPPORT_MAILTO} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15">
              <Ionicon name="mail-outline" size={16} color="#4ADE80" />
              Contact support
            </a>
          </div>
          {signedIn && (
            <>
              <Column title="Play" links={PLAY_LINKS} />
              <Column title="Discover" links={[{ label: "Venues", to: paths.venues() }, { label: "Scorecard", to: paths.scorecard }, ...COMMUNITY_LINKS.slice(1)]} />
              <Column title="Account" links={[...ACCOUNT_LINKS, { label: "Notifications", to: paths.notifications }]} />
            </>
          )}
          <Column title="Legal" links={[{ label: "Privacy Policy", to: "/privacy" }]} />
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} HitLit. All rights reserved.</p>
          <p>Book. Play. Enjoy.</p>
        </div>
      </div>
    </footer>
  );
}
