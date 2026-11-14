import { colors } from "@app/constants/theme";
import type { CommunityComment } from "@app/lib/api/communityChat";
import { formatCommunityTimeAgo } from "@app/lib/communityTime";
import { Alert } from "@/lib/alert";
import { showReportBlockActions } from "@app/lib/moderationActions";
import { Ionicon } from "../icons/Icon";
import { PollMessageCard } from "../chat/Polls";
import { MentionText } from "../chat/Mentions";

function GradientAvatar({ name, avatar, size }: { name: string | null; avatar: string | null; size: number }) {
  if (avatar) return <img src={avatar} alt="" className="shrink-0 rounded-full bg-primary-light object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

// The community post card (feed) and reply bubble (thread) from
// CommunityChatContent / CommentThreadScreen: avatar + name, time ("· Edited"),
// body with mentions or a poll, then Like / Reply / Share. The options menu
// offers Edit / Delete to the author and Report / Block to everyone else.
export default function CommentCard({
  comment,
  variant,
  isOwn,
  viewerId,
  highlighted,
  onReply,
  onEdit,
  onDelete,
  onToggleLike,
  onOpenProfile,
  onShare,
  onReport,
  onBlock,
}: {
  comment: CommunityComment;
  variant: "feed" | "root" | "reply";
  isOwn: boolean;
  viewerId: string | undefined;
  highlighted?: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onOpenProfile: () => void;
  onShare: () => void;
  onReport: (reason: string) => void;
  onBlock: () => void;
}) {
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;
  const isFeed = variant === "feed";
  const name = comment.profiles?.full_name ?? "Player";

  const openMenu = () => {
    if (isOwn) {
      Alert.alert("Message Options", undefined, [
        { text: "Edit", onPress: onEdit },
        { text: "Delete", style: "destructive", onPress: onDelete },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    showReportBlockActions({ targetName: comment.profiles?.full_name ?? "this player", onReport, onBlock });
  };

  const box = isFeed
    ? "mb-1.5 rounded-2xl border border-border bg-surface p-2.5 shadow-card"
    : highlighted
      ? "mb-3 rounded-2xl border-2 border-primary bg-primary-light p-3.5 transition-colors"
      : variant === "root"
        ? "mb-3 rounded-2xl border border-border bg-surface p-3.5"
        : "mb-3 rounded-2xl border border-primary-light bg-primary-light p-3.5 transition-colors";

  const iconSize = isFeed ? 18 : 17;
  const actionText = isFeed ? "text-sm" : "text-xs";

  return (
    <article id={`comment-${comment.id}`} className={box}>
      <div className={`flex items-start ${isFeed ? "gap-2" : "gap-2.5"}`}>
        <button type="button" onClick={onOpenProfile} aria-label={`Open ${name}'s profile`}>
          <GradientAvatar name={comment.profiles?.full_name ?? null} avatar={comment.profiles?.avatar ?? null} size={isFeed ? 30 : 36} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <button type="button" onClick={onOpenProfile} className="mr-2 min-w-0 flex-1 truncate text-left text-sm font-bold text-ink hover:underline">
              {name}
            </button>
            <button type="button" onClick={openMenu} aria-label="Message options" className="rounded-full p-1 hover:bg-gray-100">
              <Ionicon name="ellipsis-vertical" size={16} color={colors.muted} />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()}>
              {formatCommunityTimeAgo(comment.created_at)}
            </time>
            {isEdited ? " · Edited" : ""}
          </p>
          {comment.poll_id ? (
            <div className="mt-2">
              <PollMessageCard pollId={comment.poll_id} fallbackQuestion={comment.body} viewerId={viewerId} fullWidth />
            </div>
          ) : (
            <MentionText body={comment.body} mentions={comment.mentions} className="mt-2 text-sm text-ink" />
          )}
          <div className={`flex items-center gap-[18px] ${isFeed ? "mt-3" : "mt-2.5"}`}>
            <button type="button" onClick={onToggleLike} aria-pressed={comment.likedByMe} aria-label={comment.likedByMe ? "Unlike" : "Like"} className="flex items-center gap-[5px]">
              <Ionicon name={comment.likedByMe ? "heart" : "heart-outline"} size={iconSize} color={comment.likedByMe ? colors.danger : colors.muted} />
              <span className={`${actionText} font-medium text-muted`}>{comment.likeCount}</span>
            </button>
            <button type="button" onClick={onReply} className="flex items-center gap-[5px] hover:underline">
              <Ionicon name="arrow-undo-outline" size={iconSize - 1} color={colors.primary} />
              <span className={`${actionText} font-medium text-primary`}>Reply</span>
            </button>
            <button type="button" onClick={onShare} className="flex items-center gap-[5px] hover:underline">
              <Ionicon name="share-social-outline" size={iconSize - 1} color={colors.muted} />
              <span className={`${actionText} font-medium text-muted`}>Share</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
