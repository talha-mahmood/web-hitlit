import { Alert } from "react-native";

export const REPORT_REASONS = ["Spam", "Harassment or abuse", "Inappropriate content", "Other"];

// Long-press (or an overflow menu, on a profile) action sheet to report
// content or block its author going forward — required by App Store
// guideline 1.2 for apps with user-to-user content. Reporting flags the
// content for admin review without removing it for anyone; blocking only
// hides that person's content from your own view. Shared by every chat
// screen (Game/Team/Event/Squad), Community Chat, Comment Threads, and
// Player Profile so there's exactly one copy of this flow to keep in sync.
export function showReportBlockActions(opts: {
  targetName: string;
  onReport: (reason: string) => void;
  onBlock: () => void;
}) {
  const { targetName } = opts;
  Alert.alert("Message options", undefined, [
    {
      text: "Report message",
      onPress: () => {
        Alert.alert(
          "Report message",
          "Why are you reporting this?",
          REPORT_REASONS.map((reason) => ({ text: reason, onPress: () => opts.onReport(reason) }))
        );
      },
    },
    {
      text: `Block ${targetName}`,
      style: "destructive",
      onPress: () => {
        Alert.alert(`Block ${targetName}?`, "You won't see their messages in chat anymore.", [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: opts.onBlock },
        ]);
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}
