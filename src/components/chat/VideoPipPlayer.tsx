import { useState, useRef, useEffect, useCallback } from "react";
import { X, Maximize2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPipPlayerProps {
  src: string;
  onClose: () => void;
  onExpand: () => void;
}

export function VideoPipPlayer({ src, onClose, onExpand }: VideoPipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, dragStart.current.posX - dx),
        y: Math.max(0, dragStart.current.posY - dy),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // Touch drag support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY, posX: position.x, posY: position.y };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, dragStart.current.posX - dx),
        y: Math.max(0, dragStart.current.posY - dy),
      });
    };
    const onTouchEnd = () => setDragging(false);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragging]);

  return (
    <div
      className={cn(
        "fixed z-[100] shadow-2xl rounded-xl overflow-hidden border border-border/50 bg-black",
        "animate-in slide-in-from-bottom-4 fade-in duration-300",
        dragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        right: position.x,
        bottom: position.y,
        width: "280px",
      }}
    >
      {/* Drag handle */}
      <div
        className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-between px-2 bg-gradient-to-b from-black/60 to-transparent"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMuted(!muted)}
            className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onExpand}
            className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted={muted}
        loop
        playsInline
        className="w-full aspect-video object-cover"
      />
    </div>
  );
}
