import { useState, useRef, useCallback, useEffect } from "react";
import { Reply, Forward, Pin, PinOff, Trash2, Pencil, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticsImpact } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🎉", "👏"];

interface MobileLongPressMenuProps {
  children: React.ReactNode;
  messageId: string;
  onReply: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  isPinned: boolean;
  isMe: boolean;
  disabled?: boolean;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function MobileLongPressMenu({
  children,
  messageId,
  onReply,
  onForward,
  onPin,
  onDelete,
  onEdit,
  onCopy,
  isPinned,
  isMe,
  disabled,
}: MobileLongPressMenuProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const LONG_PRESS_MS = 500;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !isMobile) return;
      const touch = e.touches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY };
      movedRef.current = false;

      timerRef.current = setTimeout(() => {
        if (!movedRef.current) {
          hapticsImpact();
          setPosition({ x: touch.clientX, y: touch.clientY });
          setOpen(true);
        }
      }, LONG_PRESS_MS);
    },
    [disabled, isMobile]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchRef.current.x);
      const dy = Math.abs(touch.clientY - touchRef.current.y);
      if (dx > 10 || dy > 10) {
        movedRef.current = true;
        clearTimer();
      }
    },
    [clearTimer]
  );

  const handleTouchEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const id = setTimeout(() => {
      document.addEventListener("touchstart", close, { once: true });
      document.addEventListener("click", close, { once: true });
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("click", close);
    };
  }, [open]);

  const toggleReaction = async (emoji: string) => {
    if (!user) return;
    setOpen(false);

    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("emoji", emoji)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("reactions")
        .insert({ message_id: messageId, emoji, user_id: user.id });
    }
  };

  const menuItems = [
    { icon: Reply, label: "Reply", action: onReply, show: true },
    { icon: Forward, label: "Forward", action: onForward, show: true },
    { icon: isPinned ? PinOff : Pin, label: isPinned ? "Unpin" : "Pin", action: onPin, show: true },
    { icon: Copy, label: "Copy", action: onCopy, show: !!onCopy },
    { icon: Pencil, label: "Edit", action: onEdit, show: !!onEdit },
    { icon: Trash2, label: "Delete", action: onDelete, show: !!onDelete, destructive: true },
  ].filter((item) => item.show);

  const doAction = (action?: () => void) => {
    setOpen(false);
    action?.();
  };

  const menuWidth = 220;
  const emojiRowHeight = 48;
  const menuHeight = menuItems.length * 44 + emojiRowHeight + 8;
  const safeX = Math.min(Math.max(position.x - menuWidth / 2, 8), window.innerWidth - menuWidth - 8);
  const safeY = position.y - menuHeight - 12 > 0 ? position.y - menuHeight - 12 : position.y + 12;

  if (!isMobile) return <>{children}</>;

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "auto" }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />

          <div
            className="absolute bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in zoom-in-90 fade-in-0 duration-150"
            style={{ left: safeX, top: safeY, width: menuWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick emoji reactions row */}
            <div className="flex items-center justify-around px-2 py-1.5 border-b border-border">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg active:scale-125 transition-transform hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action items */}
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => doAction(item.action)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors active:bg-accent",
                  item.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-popover-foreground hover:bg-accent"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
