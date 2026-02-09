import { useState, useEffect } from "react";
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
      // Remove
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      // Add
      const tempId = crypto.randomUUID();
      setReactions((prev) => [...prev, { id: tempId, emoji, user_id: user.id }]);
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

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", isMe && "justify-end")}>
      {grouped.map((g) => (
        <button
          key={g.emoji}
          onClick={() => toggleReaction(g.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors border",
            g.myReactionId
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-muted/80 border-transparent hover:bg-muted text-foreground"
          )}
        >
          <span>{g.emoji}</span>
          <span className="font-medium min-w-[0.75rem] text-center">{g.count}</span>
        </button>
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
