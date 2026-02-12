import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface SmartReplySuggestionsProps {
  messages: Array<{ content: string; isMe: boolean }>;
  language: string;
  onSelect: (reply: string) => void;
}

export function SmartReplySuggestions({ messages, language, onSelect }: SmartReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const fetchSuggestions = async () => {
    if (loading) return;
    
    if (visible && suggestions.length > 0) {
      setVisible(false);
      return;
    }

    setLoading(true);
    setVisible(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-smart-replies", {
        body: { messages, language },
      });
      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Smart reply error:", err);
      setSuggestions(["👍", "OK!", "😊"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={fetchSuggestions}
        disabled={loading || messages.length === 0}
        title="Gợi ý trả lời AI"
        className={cn(
          "shrink-0 transition-colors",
          visible ? "text-primary" : "text-muted-foreground hover:text-primary"
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </Button>

      {visible && suggestions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(s);
                setVisible(false);
              }}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
