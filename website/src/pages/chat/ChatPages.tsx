import { useLocation, useParams } from "react-router";
import { colors } from "@app/constants/theme";
import { useGameMessages, useSendGameMessage } from "@app/hooks/useGameMessages";
import { useTeamMessages, useSendTeamMessage } from "@app/hooks/useTeamMessages";
import { useSquadMessages, useSendSquadMessage } from "@app/hooks/useSquadMessages";
import { useEventMessages, useSendEventMessage } from "@app/hooks/useEventMessages";
import { useEventDetail } from "@app/hooks/useEvents";
import { markEventChatRead } from "@app/lib/api/eventMessages";
import { useGameDetail } from "@app/hooks/useGames";
import { useSquadDetail } from "@app/hooks/useSquads";
import { markGameChatRead } from "@app/lib/api/gameMessages";
import { markTeamChatRead } from "@app/lib/api/teamMessages";
import { markSquadChatRead } from "@app/lib/api/squadMessages";
import { getSportIcon } from "@app/lib/sportIcons";
import { MCIcon } from "@/components/icons/Icon";
import ChatRoom, { type ChatMessage } from "@/components/chat/ChatRoom";
import { paths } from "@/routes/paths";

type ChatState = { gameTitle?: string; isTournament?: boolean; sportName?: string; teamName?: string; squadName?: string; eventName?: string } | null;

function SportWatermark({ sportName, iconName }: { sportName?: string; iconName?: string }) {
  const icon = iconName ?? getSportIcon(sportName ?? "").icon;
  return (
    <>
      <MCIcon name={icon} size={220} color={colors.primary} className="pointer-events-none absolute -right-12 -top-2.5 opacity-[0.08]" style={{ transform: "rotate(12deg)" }} />
      <MCIcon name={icon} size={130} color={colors.primary} className="pointer-events-none absolute bottom-32 right-2.5 opacity-[0.07]" style={{ transform: "rotate(-18deg)" }} />
    </>
  );
}

export function GameChatPage() {
  const { gameId = "" } = useParams();
  const state = useLocation().state as ChatState;
  const { data: game } = useGameDetail(gameId);
  const isTournament = state?.isTournament ?? game?.game_type === "TOURNAMENT";
  const sportName = state?.sportName ?? game?.sports?.name ?? undefined;
  const title = state?.gameTitle ?? game?.title;
  const memberLabel = isTournament ? "tournament members" : "game members";
  const sport = getSportIcon(sportName ?? "");
  return (
    <ChatRoom
      kind="game"
      contextId={gameId}
      title={isTournament ? "Tournament Chat" : "Game Chat"}
      subtitle={title}
      subtitleIcon={<MCIcon name={sport.icon} size={13} color={sport.fg} />}
      watermarkIcon={<SportWatermark sportName={sportName} />}
      placeholder={`Message the ${memberLabel}...`}
      emptyText={`No messages yet. Say hi to the ${memberLabel}!`}
      fallbackName="Player"
      reportSource="game_message"
      messagesQuery={useGameMessages(gameId)}
      send={useSendGameMessage(gameId)}
      markRead={markGameChatRead}
      unreadKey="gameChatUnread"
      backFallback={paths.game(gameId)}
    />
  );
}

export function TeamChatPage() {
  const { teamId = "" } = useParams();
  const state = useLocation().state as ChatState;
  const sport = getSportIcon(state?.sportName ?? "");
  return (
    <ChatRoom
      kind="team"
      contextId={teamId}
      title="Team Chat"
      subtitle={state?.teamName}
      subtitleIcon={<MCIcon name={sport.icon} size={13} color={sport.fg} />}
      watermarkIcon={<SportWatermark sportName={state?.sportName} />}
      placeholder="Message your team..."
      emptyText="No messages yet. Say hi to your team!"
      fallbackName="Member"
      reportSource="team_message"
      messagesQuery={useTeamMessages(teamId)}
      send={useSendTeamMessage(teamId)}
      markRead={markTeamChatRead}
      unreadKey="teamChatUnread"
      backFallback={paths.community}
    />
  );
}

export function SquadChatPage() {
  const { squadId = "" } = useParams();
  const state = useLocation().state as ChatState;
  const { data: squad } = useSquadDetail(squadId);
  return (
    <ChatRoom
      kind="squad"
      contextId={squadId}
      title="Squad Chat"
      subtitle={state?.squadName ?? squad?.name}
      subtitleIcon={<MCIcon name="account-group" size={13} color={colors.primaryDark} />}
      watermarkIcon={<SportWatermark iconName="account-group" />}
      placeholder="Message the squad..."
      emptyText="No messages yet. Say hi to the squad!"
      fallbackName="Member"
      reportSource="squad_message"
      messagesQuery={useSquadMessages(squadId)}
      send={useSendSquadMessage(squadId)}
      markRead={markSquadChatRead}
      unreadKey="squadChatUnread"
      backFallback={paths.squad(squadId)}
    />
  );
}

// Port of EventChatScreen (same chat as the squad one, calendar motif).
export function EventChatPage() {
  const { eventId = "" } = useParams();
  const state = useLocation().state as ChatState;
  const { data: event } = useEventDetail(eventId);
  return (
    <ChatRoom
      kind="event"
      contextId={eventId}
      title="Event Chat"
      subtitle={state?.eventName ?? event?.name}
      subtitleIcon={<MCIcon name="calendar" size={13} color={colors.primaryDark} />}
      watermarkIcon={<SportWatermark iconName="calendar-star" />}
      placeholder="Message the event..."
      emptyText="No messages yet. Say hi to the event!"
      fallbackName="Member"
      reportSource="event_message"
      messagesQuery={useEventMessages(eventId)}
      send={useSendEventMessage(eventId)}
      markRead={markEventChatRead}
      unreadKey="eventChatUnread"
      backFallback={paths.event(eventId)}
    />
  );
}

export type { ChatMessage };
