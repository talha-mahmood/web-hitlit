import { useState } from "react";
import { EMOJI_CATEGORIES } from "@app/lib/emojiList";
import Modal from "../ui/Modal";

// Port of EmojiPickerSheet — category pills + emoji grid, shared by every
// chat composer. Picking hands the character back; the composer splices it in.
export default function EmojiPickerSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (emoji: string) => void }) {
  const [category, setCategory] = useState(0);
  return (
    <Modal open={open} onClose={onClose} title="Emoji" maxWidth={440}>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setCategory(i)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${category === i ? "bg-primary text-white" : "bg-gray-100 text-muted hover:text-ink"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 py-3">
        {EMOJI_CATEGORIES[category].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={emoji}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[26px] transition hover:bg-gray-100"
          >
            {emoji}
          </button>
        ))}
      </div>
    </Modal>
  );
}
