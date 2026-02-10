import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🎉", "👏"];

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  userIds: string[];
  myReactionId: string | null;
}

interface MessageReactionsProps {
  messageId: string;
  isMe: boolean;
}

export function MessageReactions({ messageId, isMe }: MessageReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailEmoji, setDetailEmoji] = useState<string | null>(null);
  const [detailNames, setDetailNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [burstParticles, setBurstParticles] = useState<{ id: string; emoji: string; x: number; y: number; dx: number; dy: number; scale: number; rotation: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const spawnFloatingEmoji = (emoji: string, originEl?: HTMLElement) => {
    const x = originEl
      ? originEl.offsetLeft + originEl.offsetWidth / 2 - 12
      : Math.random() * 60;
    const id = crypto.randomUUID();
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 900);

    // Spawn burst particles
    const cx = originEl ? originEl.offsetLeft + originEl.offsetWidth / 2 : 30;
    const cy = originEl ? originEl.offsetTop + originEl.offsetHeight / 2 : 0;
    const count = 6 + Math.floor(Math.random() * 4);
    const newParticles: typeof burstParticles = Array.from({ length: count }, () => ({
      id: crypto.randomUUID() as string,
      emoji,
      x: cx,
      y: cy,
      dx: (Math.random() - 0.5) * 120,
      dy: -Math.random() * 80 - 20,
      scale: 0.4 + Math.random() * 0.5,
      rotation: (Math.random() - 0.5) * 360,
    }));
    setBurstParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      const ids = new Set(newParticles.map((p) => p.id));
      setBurstParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 750);
  };

  useEffect(() => {
    loadReactions();
  }, [messageId]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from("reactions")
      .select("id, emoji, user_id")
      .eq("message_id", messageId);
    if (data) setReactions(data);
  };

  const grouped: GroupedReaction[] = (() => {
    const map = new Map<string, GroupedReaction>();
    for (const r of reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(r.user_id);
        if (r.user_id === user?.id) existing.myReactionId = r.id;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          userIds: [r.user_id],
          myReactionId: r.user_id === user?.id ? r.id : null,
        });
      }
    }
    return Array.from(map.values());
  })();

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    setPickerOpen(false);

    const existing = reactions.find((r) => r.emoji === emoji && r.user_id === user.id);
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      spawnFloatingEmoji(emoji);
      const tempId = crypto.randomUUID();
      const { data, error } = await supabase
        .from("reactions")
        .insert({ message_id: messageId, emoji, user_id: user.id })
        .select("id")
        .single();
      if (data) {
        setReactions((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: data.id } : r)));
      } else if (error) {
        setReactions((prev) => prev.filter((r) => r.id !== tempId));
      }
    }
  };

  const showReactors = useCallback(async (g: GroupedReaction) => {
    setDetailEmoji(g.emoji);
    setLoadingNames(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", g.userIds);
    setDetailNames(
      data?.map((p) => (p.user_id === user?.id ? "You" : p.display_name)) || []
    );
    setLoadingNames(false);
  }, [user?.id]);

  return (
    <div ref={containerRef} className={cn("relative flex items-center gap-1 flex-wrap", isMe && "justify-end")}>
      {/* Floating emoji particles */}
      {floatingEmojis.map((fe) => (
        <span
          key={fe.id}
          className="emoji-float-particle"
          style={{ left: fe.x, bottom: '100%' }}
        >
          {fe.emoji}
        </span>
      ))}

      {/* Burst particles */}
      {burstParticles.map((p) => (
        <span
          key={p.id}
          className="emoji-burst-particle"
          style={{
            left: p.x,
            top: p.y,
            '--burst-dx': `${p.dx}px`,
            '--burst-dy': `${p.dy}px`,
            '--burst-scale': p.scale,
            '--burst-rotation': `${p.rotation}deg`,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}

      {grouped.map((g) => (
        <Popover
          key={g.emoji}
          open={detailEmoji === g.emoji}
          onOpenChange={(open) => {
            if (!open) setDetailEmoji(null);
          }}
        >
          <PopoverTrigger asChild>
            <button
              onClick={(e) => {
                toggleReaction(g.emoji);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                showReactors(g);
              }}
              onTouchEnd={(e) => {
                // Long-press is handled by parent; single tap toggles.
              }}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors border",
                g.myReactionId
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-muted/80 border-transparent hover:bg-muted text-foreground"
              )}
            >
              <span>{g.emoji}</span>
              <span
                className="font-medium min-w-[0.75rem] text-center underline decoration-dotted cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  showReactors(g);
                }}
              >
                {g.count}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[200px] p-2"
            side="top"
            align={isMe ? "end" : "start"}
          >
            <div className="text-xs space-y-1">
              <p className="font-semibold text-center text-base">{g.emoji}</p>
              {loadingNames ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : (
                detailNames.map((name, i) => (
                  <p key={i} className="text-foreground">{name}</p>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      ))}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover/msg:opacity-100"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" side="top" align={isMe ? "end" : "start"}>
          <div className="flex gap-0.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
