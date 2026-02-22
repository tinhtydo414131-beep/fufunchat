import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TranslateButtonProps {
  text: string;
  messageId: string;
  targetLanguage: string;
  isMe: boolean;
}

const LANG_NAMES: Record<string, string> = {
  vi: "Tiếng Việt", en: "English", es: "Español", pt: "Português",
  hi: "हिन्दी", ar: "العربية", he: "עברית", fa: "فارسی",
  tr: "Türkçe", ja: "日本語", ko: "한국어", zh: "中文",
};

const LANG_FLAGS: Record<string, string> = {
  vi: "🇻🇳", en: "🇺🇸", es: "🇪🇸", pt: "🇧🇷", hi: "🇮🇳",
  ar: "🇸🇦", he: "🇮🇱", fa: "🇮🇷", tr: "🇹🇷",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳",
};

// Cache translations in memory
const translationCache = new Map<string, string>();

export function TranslateButton({ text, messageId, targetLanguage, isMe }: TranslateButtonProps) {
  const [translated, setTranslated] = useState<string | null>(() => translationCache.get(messageId) || null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(!!translationCache.has(messageId));

  const handleTranslate = async () => {
    if (translated) {
      setShowTranslation(!showTranslation);
      return;
    }

    setLoading(true);
    try {
      const langName = LANG_NAMES[targetLanguage] || targetLanguage;
      const { data, error } = await supabase.functions.invoke("translate-message", {
        body: { text, targetLanguage: langName },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const result = data.translatedText;
      translationCache.set(messageId, result);
      setTranslated(result);
      setShowTranslation(true);
    } catch (e) {
      toast.error("Không thể dịch tin nhắn");
    } finally {
      setLoading(false);
    }
  };

  const flag = LANG_FLAGS[targetLanguage] || "🌐";

  return (
    <div className="space-y-1">
      <button
        onClick={handleTranslate}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 text-[10px] px-1 py-0.5 rounded transition-colors",
          "text-muted-foreground hover:text-primary hover:bg-primary/5"
        )}
        title="Dịch tin nhắn"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Languages className="w-3 h-3" />
        )}
        <span>{showTranslation ? "Ẩn dịch" : "Dịch"}</span>
      </button>

      {showTranslation && translated && (
        <div className={cn(
          "text-xs px-2 py-1.5 rounded-lg border-l-2 border-primary/30",
          isMe ? "bg-primary-foreground/10" : "bg-muted/60"
        )}>
          <span className="text-[10px] text-muted-foreground font-medium">
            {flag} Bản dịch
          </span>
          <p className="mt-0.5">{translated}</p>
        </div>
      )}
    </div>
  );
}
