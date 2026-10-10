import { Platform, Share } from "react-native";

// A real https:// link (Universal Links on iOS, App Links on Android) —
// unlike the app's own playoye:// scheme, this is what lets WhatsApp/SMS/etc
// actually render it as a tappable link, and it opens the app directly on a
// device that has it installed (see app.json's associatedDomains/
// intentFilters, and deep-link-setup/ for the hosting side of this).
const SHARE_LINK_DOMAIN = "https://hitlit.pk";

// Deep-links straight to a comment: a shared post/root comment opens plain,
// a shared reply opens with its id in `highlight` so the receiving screen
// can scroll to and flash that specific reply (see CommentThreadScreen).
export function buildCommentShareUrl(rootId: string, replyId?: string): string {
  const url = `${SHARE_LINK_DOMAIN}/comment/${rootId}`;
  return replyId ? `${url}?highlight=${replyId}` : url;
}

export async function shareComment(rootId: string, replyId?: string): Promise<void> {
  const url = buildCommentShareUrl(rootId, replyId);
  try {
    // iOS treats `url` as its own share item (shown/attached as a real
    // link); Android's Share API has no separate url field, so the link
    // has to be the message itself.
    await Share.share(Platform.OS === "ios" ? { url, message: url } : { message: url });
  } catch {
    // User dismissed the share sheet — nothing to do.
  }
}
