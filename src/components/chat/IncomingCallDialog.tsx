import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CallState } from "@/hooks/useCall";

interface IncomingCallDialogProps {
  call: CallState;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallDialog({ call, onAnswer, onDecline }: IncomingCallDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 min-w-[280px] max-w-[340px] mx-4 border border-border">
        {/* Pulsing avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {call.callerName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            {call.callType === "video" ? (
              <Video className="w-3 h-3 text-white" />
            ) : (
              <Phone className="w-3 h-3 text-white" />
            )}
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-foreground">{call.callerName}</h3>
          <p className="text-sm text-muted-foreground">
            Incoming {call.callType} call...
          </p>
        </div>

        <div className="flex items-center gap-6">
          <Button
            onClick={onDecline}
            className="w-14 h-14 rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg"
            size="icon"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
          <Button
            onClick={onAnswer}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg"
            size="icon"
          >
            <Phone className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
