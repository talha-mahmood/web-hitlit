import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";

// Deep-links straight to a comment: a shared post/root comment opens plain,
// a shared reply opens with its id in `highlight` so the receiving screen
// can scroll to and flash that specific reply (see CommentThreadScreen).
export function buildCommentShareUrl(rootId: string, replyId?: string): string {
  return Linking.createURL(`comment/${rootId}`, {
    queryParams: replyId ? { highlight: replyId } : undefined,
  });
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
