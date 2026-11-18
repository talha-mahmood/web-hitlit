import { colors } from "@app/constants/theme";
import { Ionicon, MCIcon } from "@/components/icons/Icon";
import bannerImg from "@/assets/web/community-banner.webp";
import chatImg from "@/assets/web/community-chat.webp";
import playersImg from "@/assets/web/community-top-players.webp";
import eventsImg from "@/assets/web/community-explore-events.webp";
import campsImg from "@/assets/web/community-training-camps.webp";
import { useAppNavigate, useGoBack } from "@/routes/navigation";
import { paths } from "@/routes/paths";
import PlayersDashboardContent from "../players/PlayersDashboardContent";
import CommunityChatContent from "./CommunityChatContent";

type Segment = "community" | "players" | "chat";

// Square illustration filling the card edge to edge, then a sentence-case
// title and a one-line description; the border sits on top of the image.
function ImageCard({ image, title, description, onPress }: { image: string; title: string; description: string; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} className="press group relative block w-full overflow-hidden rounded-[22px] bg-surface text-left shadow-card transition-shadow hover:shadow-hero">
      <span className="block aspect-[1/0.82] overflow-hidden">
        <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      </span>
      <span className="block h-[58px] px-2.5 pt-2.5">
        <span className="block truncate text-[15px] font-extrabold leading-[18px] text-ink sm:text-base">{title}</span>
        <span className="mt-0.5 block truncate text-[10px] leading-[13px] text-muted sm:text-xs">{description}</span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-[22px] border-[1.5px] border-border" />
    </button>
  );
}

// Port of CommunityScreen. The app swaps three segments in place under one
// header; here each is its own URL (/community, /community/players,
// /community/chat) so back/forward and shared links behave as expected.
// The header's back arrow returns from a segment to the cards first.
export default function CommunityPage({ segment }: { segment: Segment }) {
  const navigate = useAppNavigate();
  const goBack = useGoBack(segment === "community" ? paths.home : paths.community);
  const title = segment === "players" ? "Top Players" : segment === "chat" ? "Community Chat" : "Community";

  return (
    <div className="mx-auto max-w-6xl lg:px-8">
      <header className="sticky top-0 z-20 bg-app/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur lg:px-0 lg:pt-6">
        <div className="flex min-h-11 items-center gap-3.5">
          <button type="button" onClick={goBack} aria-label="Back" className="rounded-full p-1 hover:bg-black/5">
            <Ionicon name="arrow-back" size={22} color={colors.ink} />
          </button>
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-surface-raised">
            <MCIcon name="account-group" size={23} color={colors.primary} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold text-ink">{title}</h1>
            <p className="mt-px truncate text-[11px] text-muted">Play Together, Stay Active</p>
          </div>
        </div>
      </header>

      {segment === "community" && (
        <div className="px-4 pb-8 pt-[18px] lg:px-0">
          <img src={bannerImg} alt="" className="-mx-4 mb-[22px] block aspect-[2045/769] w-[calc(100%+32px)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-[22px]" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-[22px] lg:grid-cols-4">
            <ImageCard image={chatImg} title="Community Chat" description="Chat with the community" onPress={() => navigate(paths.communityChat)} />
            <ImageCard image={playersImg} title="Find Players" description="Discover players near you" onPress={() => navigate(paths.communityPlayers)} />
            <ImageCard image={eventsImg} title="Explore Events" description="Discover upcoming events" onPress={() => navigate(paths.events())} />
            <ImageCard image={campsImg} title="Explore Training Camps" description="Find training camps near you" onPress={() => navigate(paths.trainingCamps)} />
          </div>
        </div>
      )}

      {segment === "players" && (
        <div className="mt-3 lg:mt-6">
          <PlayersDashboardContent onPressPlayer={(userId, sport) => navigate(paths.player(userId, sport))} />
        </div>
      )}

      {segment === "chat" && (
        <div className="mt-3 lg:mt-6">
          <CommunityChatContent onReply={(rootId) => navigate(paths.commentThread(rootId))} onOpenProfile={(userId) => navigate(paths.player(userId))} />
        </div>
      )}
    </div>
  );
}
