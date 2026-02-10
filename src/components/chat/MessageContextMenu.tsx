import { useState, useRef, useCallback, useEffect } from "react";
import { Reply, Forward, Pin, PinOff, Trash2, Pencil, Copy, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🎉", "👏"];

interface MessageContextMenuProps {
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

export function MessageContextMenu({
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
}: MessageContextMenuProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  const openMenu = useCallback((x: number, y: number) => {
    if (disabled) return;
    setPosition({ x, y });
    setOpen(true);
  }, [disabled]);

  // Mobile long-press handler
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      touchRef.current = { x: touch.clientX, y: touch.clientY };
      movedRef.current = false;

      timerRef.current = setTimeout(() => {
        if (!movedRef.current) {
          if (navigator.vibrate) navigator.vibrate(20);
          openMenu(touch.clientX, touch.clientY);
        }
      }, LONG_PRESS_MS);
    },
    [disabled, openMenu]
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

  // Desktop right-click handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      openMenu(e.clientX, e.clientY);
    },
    [disabled, openMenu]
  );

  // Hover "⋮" button click — Telegram-style action trigger
  const handleActionButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openMenu(rect.left + rect.width / 2, rect.bottom + 4);
    },
    [openMenu]
  );

  // Close the menu on any click/touch outside
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-menu]')) return;
      setOpen(false);
    };
    const id = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
      window.addEventListener("scroll", () => setOpen(false), { once: true, capture: true });
    }, 100);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
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
    { icon: Copy, label: "Copy", action: onCopy, show: !!onCopy },
    { icon: Pencil, label: "Edit", action: onEdit, show: !!onEdit },
    { icon: Forward, label: "Forward", action: onForward, show: true },
    { icon: isPinned ? PinOff : Pin, label: isPinned ? "Unpin" : "Pin", action: onPin, show: true },
    { icon: Trash2, label: "Delete", action: onDelete, show: !!onDelete, destructive: true },
  ].filter((item) => item.show);

  const doAction = (action?: () => void) => {
    setOpen(false);
    action?.();
  };

  const menuWidth = 220;
  const emojiRowHeight = 48;
  const menuHeight = menuItems.length * 40 + emojiRowHeight + 8;
  const safeX = Math.min(Math.max(position.x - menuWidth / 2, 8), window.innerWidth - menuWidth - 8);
  const safeY = position.y - menuHeight - 12 > 0 ? position.y - menuHeight - 12 : position.y + 12;

  return (
    <>
      <div
        className="relative group/ctx"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        ref={wrapperRef}
      >
        {children}

        {/* Telegram-style hover action button — always works regardless of iframe restrictions */}
        {!disabled && hovered && !open && (
          <button
            onClick={handleActionButtonClick}
            className={cn(
              "absolute top-1 z-10 w-7 h-7 rounded-full flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm",
              "opacity-0 group-hover/ctx:opacity-100 transition-opacity duration-150",
              "hover:bg-accent hover:scale-110 active:scale-95",
              isMe ? "left-1" : "right-1"
            )}
            title="Message actions"
          >
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "auto" }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          <div
            data-context-menu
            className="absolute bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-90 fade-in-0 duration-150"
            style={{ left: safeX, top: safeY, width: menuWidth }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Quick emoji reactions row */}
            <div className="flex items-center justify-around px-2 py-1.5 border-b border-border/50 bg-muted/30">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg hover:scale-125 active:scale-125 transition-transform hover:bg-accent"
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
                  "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors",
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
