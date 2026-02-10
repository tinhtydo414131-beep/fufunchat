import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CallState } from "@/hooks/useCall";

interface ActiveCallOverlayProps {
  call: CallState;
  duration: number;
  formatDuration: (secs: number) => string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeaker: boolean;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  remoteStreamRef: React.MutableRefObject<MediaStream | null>;
}

export function ActiveCallOverlay({
  call,
  duration,
  formatDuration,
  isMuted,
  isVideoEnabled,
  isSpeaker,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  localStreamRef,
  remoteStreamRef,
}: ActiveCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [remoteStreamRef.current]);

  // Continuously check for remote stream
  useEffect(() => {
    const interval = setInterval(() => {
      if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const isVideo = call.callType === "video";
  const isRinging = call.status === "ringing";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
      {/* Call content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            {/* Remote video - full screen */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Local video - PiP */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-4 right-4 w-32 h-44 rounded-2xl object-cover border-2 border-background shadow-lg z-10"
            />
            {/* Dark overlay for controls visibility */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center">
              <div className={cn("w-24 h-24 rounded-full bg-primary/30 flex items-center justify-center", isRinging && "animate-pulse")}>
                <span className="text-4xl font-bold text-primary">
                  {call.callerName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">{call.callerName}</h2>
              <p className="text-sm text-muted-foreground">
                {isRinging
                  ? (call.isOutgoing ? "Calling..." : "Incoming call...")
                  : formatDuration(duration)}
              </p>
            </div>
            {/* Hidden audio element for voice calls */}
            <audio ref={remoteVideoRef as any} autoPlay playsInline />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={cn(
        "pb-12 pt-6 px-6 flex items-center justify-center gap-5",
        isVideo ? "absolute bottom-0 inset-x-0 z-20" : ""
      )}>
        <Button
          onClick={onToggleMute}
          variant="ghost"
          className={cn(
            "w-14 h-14 rounded-full",
            isMuted ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"
          )}
          size="icon"
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        {isVideo && (
          <Button
            onClick={onToggleVideo}
            variant="ghost"
            className={cn(
              "w-14 h-14 rounded-full",
              !isVideoEnabled ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"
            )}
            size="icon"
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>
        )}

        <Button
          onClick={onToggleSpeaker}
          variant="ghost"
          className={cn(
            "w-14 h-14 rounded-full",
            isSpeaker ? "bg-primary/20 text-primary" : "bg-muted text-foreground"
          )}
          size="icon"
        >
          <Volume2 className="w-6 h-6" />
        </Button>

        <Button
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg"
          size="icon"
        >
          <PhoneOff className="w-7 h-7" />
        </Button>
      </div>

      {/* Duration badge for video calls */}
      {isVideo && !isRinging && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-4 py-1.5 rounded-full text-sm font-mono backdrop-blur-sm">
          {formatDuration(duration)}
        </div>
      )}
      {isVideo && isRinging && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-4 py-1.5 rounded-full text-sm backdrop-blur-sm">
          {call.isOutgoing ? "Calling..." : "Connecting..."}
        </div>
      )}
    </div>
  );
}
