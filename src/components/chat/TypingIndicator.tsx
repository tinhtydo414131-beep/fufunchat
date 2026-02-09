import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useI18n";

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const { t } = useTranslation();
  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? t("chat.typingOne").replace("{name}", names[0])
      : names.length === 2
        ? t("chat.typingTwo").replace("{name1}", names[0]).replace("{name2}", names[1])
        : t("chat.typingMany").replace("{name}", names[0]).replace("{count}", String(names.length - 1));

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            )}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <span>{text}</span>
    </div>
  );
}
