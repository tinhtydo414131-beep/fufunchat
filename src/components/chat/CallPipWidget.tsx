import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CallState } from "@/hooks/useCall";

interface CallPipWidgetProps {
  call: CallState;
  duration: number;
  formatDuration: (secs: number) => string;
  isMuted: boolean;
  onEndCall: () => void;
  onToggleMute: () => void;
  onExpand: () => void;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  remoteStreamRef: React.MutableRefObject<MediaStream | null>;
}

export function CallPipWidget({
  call,
  duration,
  formatDuration,
  isMuted,
  onEndCall,
  onToggleMute,
  onExpand,
  localStreamRef,
  remoteStreamRef,
}: CallPipWidgetProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isVideo = call.callType === "video";
  const isRinging = call.status === "ringing";

  // Attach remote stream
  useEffect(() => {
    const interval = setInterval(() => {
      if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 120, e.clientY - dragOffset.current.y)),
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  return (
    <div
      className="fixed z-[9998] select-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-border bg-card cursor-grab active:cursor-grabbing"
        style={{ width: isVideo ? 180 : 200 }}
      >
        {/* Video / Avatar area */}
        {isVideo ? (
          <div className="relative w-full h-[100px] bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Expand button */}
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="relative w-full h-[60px] bg-primary/10 flex items-center justify-center">
            <audio ref={remoteVideoRef as any} autoPlay playsInline />
            <span className="text-lg font-bold text-primary">
              {call.callerName.slice(0, 2).toUpperCase()}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(); }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Controls bar */}
        <div className="px-2 py-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "text-[10px] font-mono",
              isRinging ? "text-primary animate-pulse" : "text-muted-foreground"
            )}>
              {isRinging ? "Calling..." : formatDuration(duration)}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
              {call.callerName}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn("w-7 h-7 rounded-full", isMuted && "text-destructive")}
              onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
            >
              {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </Button>
            <Button
              size="icon"
              className="w-7 h-7 rounded-full bg-destructive hover:bg-destructive/90 text-white"
              onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            >
              <PhoneOff className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
