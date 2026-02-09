import { useRef, useState, useCallback } from "react";
import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeToReplyProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMe: boolean;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 60;

export function SwipeToReply({ children, onSwipeReply, isMe, disabled }: SwipeToReplyProps) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false); // lock direction after first move
  const triggered = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;
    locked.current = false;
    triggered.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock direction on first significant move
    if (!locked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      locked.current = true;
      swiping.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!swiping.current) return;

    // For own messages (right side): swipe left (negative dx) to reply
    // For other messages (left side): swipe right (positive dx) to reply
    const swipeDir = isMe ? -dx : dx;
    if (swipeDir < 0) {
      setOffsetX(0);
      return;
    }

    const clamped = Math.min(swipeDir, SWIPE_THRESHOLD + 20);
    setOffsetX(isMe ? -clamped : clamped);

    if (clamped >= SWIPE_THRESHOLD && !triggered.current) {
      triggered.current = true;
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(15);
    }
  }, [disabled, isMe]);

  const handleTouchEnd = useCallback(() => {
    if (triggered.current) {
      onSwipeReply();
    }
    setOffsetX(0);
    swiping.current = false;
    locked.current = false;
  }, [onSwipeReply]);

  const progress = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);

  return (
    <div className="relative overflow-visible">
      {/* Reply icon indicator */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-100",
          isMe ? "right-0" : "left-0"
        )}
        style={{
          opacity: progress,
          transform: `translateY(-50%) scale(${0.5 + progress * 0.5})`,
          [isMe ? "right" : "left"]: `${-28}px`,
        }}
      >
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center",
          progress >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Reply className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Swipeable content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
