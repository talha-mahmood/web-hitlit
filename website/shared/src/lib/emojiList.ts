// A small curated set for the in-app chat emoji picker — plain Unicode
// characters, no icon font/asset/library needed; React Native's <Text>
// already renders these natively on both platforms.
export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳",
      "😅", "😇", "🙂", "🙃", "😉", "😋", "😜", "🤔", "🫡", "🤗",
      "😴", "🥱", "😮", "😲", "🥺", "😭", "😢", "😡", "🤬", "😤",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✋", "🤞", "👊",
      "✌️", "🤙", "👌", "🫶", "🤟", "👋",
    ],
  },
  {
    label: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "🔥"],
  },
  {
    label: "Sports",
    emojis: [
      "🏏", "⚽", "🏀", "🎾", "🏓", "🏸", "🥅", "🏆", "🥇", "🎯",
      "⚡", "💥", "🎉", "🎊",
    ],
  },
];
