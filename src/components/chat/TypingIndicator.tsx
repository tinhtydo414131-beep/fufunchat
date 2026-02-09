import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? `${names[0]} đang nhập...`
      : names.length === 2
        ? `${names[0]} và ${names[1]} đang nhập...`
        : `${names[0]} và ${names.length - 1} người khác đang nhập...`;

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
