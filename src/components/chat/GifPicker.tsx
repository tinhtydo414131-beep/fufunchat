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
      { label: "Rofl", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/rolling-on-the-floor-laughing_1f923.gif" },
      { label: "Hug", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/smiling-face-with-open-hands_1f917.gif" },
      { label: "Shush", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/shushing-face_1f92b.gif" },
      { label: "Nerd", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/nerd-face_1f913.gif" },
      { label: "Party Face", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/partying-face_1f973.gif" },
      { label: "Tongue Out", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-with-tongue_1f61b.gif" },
      { label: "Drool", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/drooling-face_1f924.gif" },
      { label: "Savoring", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-savoring-food_1f60b.gif" },
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
      { label: "Sob", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/crying-face_1f622.gif" },
      { label: "Scream", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-screaming-in-fear_1f631.gif" },
      { label: "Confounded", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/confounded-face_1f616.gif" },
      { label: "Tired", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/tired-face_1f62b.gif" },
      { label: "Weary", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/weary-face_1f629.gif" },
      { label: "Flushed", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/flushed-face_1f633.gif" },
      { label: "Dizzy", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/face-with-spiral-eyes_1f635-200d-1f4ab.gif" },
      { label: "Pouting", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pouting-face_1f621.gif" },
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
      { label: "Thumbs Down", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/thumbs-down_1f44e.gif" },
      { label: "Raised Fist", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/raised-fist_270a.gif" },
      { label: "Pinching", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pinching-hand_1f90f.gif" },
      { label: "Love You", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/love-you-gesture_1f91f.gif" },
      { label: "Rock On", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sign-of-the-horns_1f918.gif" },
      { label: "Call Me", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/call-me-hand_1f919.gif" },
      { label: "Point Up", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/index-pointing-up_261d-fe0f.gif" },
      { label: "Crossed Fingers", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/crossed-fingers_1f91e.gif" },
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
      { label: "Fire Heart", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/heart-on-fire_2764-fe0f-200d-1f525.gif" },
      { label: "Pink Heart", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/two-hearts_1f495.gif" },
      { label: "Heart Ribbon", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/heart-with-ribbon_1f49d.gif" },
      { label: "Love Letter", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/love-letter_1f48c.gif" },
      { label: "Heart Excl", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/heart-exclamation_2763-fe0f.gif" },
      { label: "Bouquet", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/bouquet_1f490.gif" },
      { label: "Rose", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/rose_1f339.gif" },
      { label: "Ring", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/ring_1f48d.gif" },
      { label: "Couple Heart", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/couple-with-heart_1f491.gif" },
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
      { label: "Balloon", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/balloon_1f388.gif" },
      { label: "Gift", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/wrapped-gift_1f381.gif" },
      { label: "Birthday", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/birthday-cake_1f382.gif" },
      { label: "Medal", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sports-medal_1f3c5.gif" },
      { label: "Crown", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/crown_1f451.gif" },
      { label: "Gem", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/gem-stone_1f48e.gif" },
      { label: "100", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/hundred-points_1f4af.gif" },
      { label: "Collision", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/collision_1f4a5.gif" },
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
      { label: "Bear", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/bear_1f43b.gif" },
      { label: "Rabbit", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/rabbit-face_1f430.gif" },
      { label: "Frog", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/frog_1f438.gif" },
      { label: "Penguin", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/penguin_1f427.gif" },
      { label: "Koala", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/koala_1f428.gif" },
      { label: "Lion", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/lion_1f981.gif" },
      { label: "Pig", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pig-face_1f437.gif" },
      { label: "Octopus", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/octopus_1f419.gif" },
    ],
  },
  {
    name: "Food",
    emoji: "🍕",
    stickers: [
      { label: "Pizza", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pizza_1f355.gif" },
      { label: "Burger", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/hamburger_1f354.gif" },
      { label: "Donut", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/doughnut_1f369.gif" },
      { label: "Ice Cream", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/ice-cream_1f368.gif" },
      { label: "Cookie", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cookie_1f36a.gif" },
      { label: "Cupcake", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cupcake_1f9c1.gif" },
      { label: "Hot Dog", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/hot-dog_1f32d.gif" },
      { label: "Taco", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/taco_1f32e.gif" },
      { label: "Fries", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/french-fries_1f35f.gif" },
      { label: "Popcorn", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/popcorn_1f37f.gif" },
      { label: "Coffee", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/hot-beverage_2615.gif" },
      { label: "Bubble Tea", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/bubble-tea_1f9cb.gif" },
    ],
  },
  {
    name: "Weather",
    emoji: "🌈",
    stickers: [
      { label: "Sun", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sun_2600-fe0f.gif" },
      { label: "Moon", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/full-moon-face_1f31d.gif" },
      { label: "Cloud", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cloud_2601-fe0f.gif" },
      { label: "Rain", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cloud-with-rain_1f327-fe0f.gif" },
      { label: "Lightning", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/cloud-with-lightning_1f329-fe0f.gif" },
      { label: "Snow", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/snowflake_2744-fe0f.gif" },
      { label: "Tornado", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/tornado_1f32a-fe0f.gif" },
      { label: "Umbrella", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/umbrella-with-rain-drops_2614.gif" },
      { label: "Comet", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/comet_2604-fe0f.gif" },
      { label: "Globe", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/globe-showing-americas_1f30e.gif" },
      { label: "Sunrise", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/sunrise_1f305.gif" },
      { label: "Volcano", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/volcano_1f30b.gif" },
    ],
  },
  {
    name: "Sports",
    emoji: "⚽",
    stickers: [
      { label: "Soccer", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/soccer-ball_26bd.gif" },
      { label: "Basketball", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/basketball_1f3c0.gif" },
      { label: "Football", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/american-football_1f3c8.gif" },
      { label: "Tennis", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/tennis_1f3be.gif" },
      { label: "Ping Pong", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/ping-pong_1f3d3.gif" },
      { label: "Bowling", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/bowling_1f3b3.gif" },
      { label: "Boxing", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/boxing-glove_1f94a.gif" },
      { label: "Dart", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/bullseye_1f3af.gif" },
      { label: "Video Game", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/video-game_1f3ae.gif" },
      { label: "Dice", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/game-die_1f3b2.gif" },
      { label: "Chess", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/chess-pawn_265f-fe0f.gif" },
      { label: "Pool", url: "https://em-content.zobj.net/source/animated-noto-color-emoji/356/pool-8-ball_1f3b1.gif" },
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
