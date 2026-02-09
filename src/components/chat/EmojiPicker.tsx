import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    label: "Mặt cười",
    emojis: ["😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😜", "🤗", "😎", "🥳", "😇", "🤩", "😋", "😏"],
  },
  {
    label: "Cử chỉ",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "💪", "👋", "🙏", "❤️", "🧡", "💛", "💚", "💙"],
  },
  {
    label: "Biểu tượng",
    emojis: ["⭐", "🌟", "✨", "💫", "🔥", "💯", "🎉", "🎊", "🎁", "🌈", "☀️", "🌙", "🌸", "🍀", "🦋"],
  },
  {
    label: "Đồ ăn",
    emojis: ["☕", "🍵", "🧋", "🍰", "🍫", "🍕", "🍔", "🍜", "🍣", "🍩", "🍪", "🧁", "🍿", "🥤", "🍦"],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary">
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top" align="start">
        {/* Category tabs */}
        <div className="flex gap-1 mb-2 border-b border-border pb-2">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(i)}
              className={cn(
                "text-xs px-2 py-1 rounded-md transition-colors",
                activeCategory === i
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {cat.emojis[0]} {cat.label}
            </button>
          ))}
        </div>
        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
