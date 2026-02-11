import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Free static sticker packs — no API key needed!
const STICKER_PACKS: { name: string; emoji: string; stickers: { label: string; url: string }[] }[] = [
  {
    name: "Smileys",
    emoji: "😀",
    stickers: [
      { label: "Grinning", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/grinning-face_1f600.gif" },
      { label: "Joy", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-with-tears-of-joy_1f602.gif" },
      { label: "Heart Eyes", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/smiling-face-with-heart-eyes_1f60d.gif" },
      { label: "Thinking", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/thinking-face_1f914.gif" },
      { label: "Sunglasses", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/smiling-face-with-sunglasses_1f60e.gif" },
      { label: "Wink", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/winking-face_1f609.gif" },
      { label: "Zany", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/zany-face_1f92a.gif" },
      { label: "Star Struck", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/star-struck_1f929.gif" },
      { label: "Pleading", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pleading-face_1f97a.gif" },
      { label: "Smirk", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/smirking-face_1f60f.gif" },
      { label: "Yawn", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/yawning-face_1f971.gif" },
      { label: "Mind Blown", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/exploding-head_1f92f.gif" },
    ],
  },
  {
    name: "Sad & Angry",
    emoji: "😢",
    stickers: [
      { label: "Crying", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/loudly-crying-face_1f62d.gif" },
      { label: "Angry", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/angry-face_1f620.gif" },
      { label: "Rage", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-with-symbols-on-mouth_1f92c.gif" },
      { label: "Pensive", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pensive-face_1f614.gif" },
      { label: "Worried", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/worried-face_1f61f.gif" },
      { label: "Fearful", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/fearful-face_1f628.gif" },
      { label: "Disappointed", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/disappointed-face_1f61e.gif" },
      { label: "Cold Sweat", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/anxious-face-with-sweat_1f630.gif" },
    ],
  },
  {
    name: "Gestures",
    emoji: "👋",
    stickers: [
      { label: "Waving", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/waving-hand_1f44b.gif" },
      { label: "Thumbs Up", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/thumbs-up_1f44d.gif" },
      { label: "Clap", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/clapping-hands_1f44f.gif" },
      { label: "Pray", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/folded-hands_1f64f.gif" },
      { label: "Muscle", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/flexed-biceps_1f4aa.gif" },
      { label: "Victory", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/victory-hand_270c-fe0f.gif" },
      { label: "OK", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/ok-hand_1f44c.gif" },
      { label: "Handshake", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/handshake_1f91d.gif" },
    ],
  },
  {
    name: "Hearts",
    emoji: "❤️",
    stickers: [
      { label: "Red Heart", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/red-heart_2764-fe0f.gif" },
      { label: "Sparkling", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sparkling-heart_1f496.gif" },
      { label: "Growing", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/growing-heart_1f497.gif" },
      { label: "Beating", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/beating-heart_1f493.gif" },
      { label: "Revolving", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/revolving-hearts_1f49e.gif" },
      { label: "Heart Arrow", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/heart-with-arrow_1f498.gif" },
      { label: "Kiss", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/kiss-mark_1f48b.gif" },
      { label: "Fire", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/heart-on-fire_2764-fe0f-200d-1f525.gif" },
    ],
  },
  {
    name: "Celebration",
    emoji: "🎉",
    stickers: [
      { label: "Party", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/party-popper_1f389.gif" },
      { label: "Confetti", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/confetti-ball_1f38a.gif" },
      { label: "Sparkles", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sparkles_2728.gif" },
      { label: "Trophy", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/trophy_1f3c6.gif" },
      { label: "Fire", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/fire_1f525.gif" },
      { label: "Rocket", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/rocket_1f680.gif" },
      { label: "Star", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/glowing-star_1f31f.gif" },
      { label: "Rainbow", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/rainbow_1f308.gif" },
    ],
  },
  {
    name: "Animals",
    emoji: "🐱",
    stickers: [
      { label: "Cat", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cat-face_1f431.gif" },
      { label: "Dog", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/dog-face_1f436.gif" },
      { label: "Monkey", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/see-no-evil-monkey_1f648.gif" },
      { label: "Panda", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/panda_1f43c.gif" },
      { label: "Unicorn", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/unicorn_1f984.gif" },
      { label: "Butterfly", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/butterfly_1f98b.gif" },
      { label: "Owl", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/owl_1f989.gif" },
      { label: "Fox", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/fox_1f98a.gif" },
    ],
  },
];

const ALL_STICKERS = STICKER_PACKS.flatMap((pack) =>
  pack.stickers.map((s) => ({ ...s, pack: pack.name }))
);

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [activePack, setActivePack] = useState<string | null>(null);

  const filtered = query.trim()
    ? ALL_STICKERS.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.pack.toLowerCase().includes(query.toLowerCase())
      )
    : activePack
    ? STICKER_PACKS.find((p) => p.name === activePack)?.stickers.map((s) => ({ ...s, pack: activePack })) || []
    : ALL_STICKERS;

  return (
    <div className="w-full sm:w-[340px] h-[360px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Search header */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActivePack(null); }}
            placeholder="Tìm sticker..."
            className="pl-8 pr-8 h-8 text-sm bg-muted/50 border-0"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Pack tabs */}
      <div className="flex gap-0.5 px-1.5 py-1 overflow-x-auto no-scrollbar border-b border-border/30">
        <button
          onClick={() => setActivePack(null)}
          className={cn(
            "shrink-0 px-2 py-1 text-xs rounded-full font-medium transition-colors",
            !activePack ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"
          )}
        >
          Tất cả
        </button>
        {STICKER_PACKS.map((pack) => (
          <button
            key={pack.name}
            onClick={() => setActivePack(pack.name)}
            className={cn(
              "shrink-0 px-2 py-1 text-xs rounded-full font-medium transition-colors flex items-center gap-1",
              activePack === pack.name ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"
            )}
          >
            <span>{pack.emoji}</span>
            <span>{pack.name}</span>
          </button>
        ))}
      </div>

      {/* Sticker grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Không tìm thấy sticker
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((sticker, i) => (
              <button
                key={`${sticker.pack}-${sticker.label}-${i}`}
                onClick={() => onSelect(sticker.url)}
                className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary hover:scale-110 active:scale-95 transition-all bg-muted/30 p-1 flex items-center justify-center"
                title={sticker.label}
              >
                <img
                  src={sticker.url}
                  alt={sticker.label}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-border/30 text-center">
        <span className="text-[10px] text-muted-foreground">Animated Stickers ✨</span>
      </div>
    </div>
  );
}
