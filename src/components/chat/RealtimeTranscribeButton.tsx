import { useState, useCallback } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RealtimeTranscribeButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function RealtimeTranscribeButton({ onTranscript, className }: RealtimeTranscribeButtonProps) {
  const [connecting, setConnecting] = useState(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      // Show partial text live in the input
      if (data.text) {
        onTranscript(data.text);
      }
    },
    onCommittedTranscript: (data) => {
      if (data.text) {
        onTranscript(data.text);
      }
    },
  });

  const handleToggle = useCallback(async () => {
    if (scribe.isConnected) {
      scribe.disconnect();
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error) throw error;
      if (!data?.token) throw new Error("No token received");

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      console.error("Realtime STT error:", err);
      toast.error("Không thể bắt đầu nhận diện giọng nói");
    } finally {
      setConnecting(false);
    }
  }, [scribe]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={connecting}
      title={scribe.isConnected ? "Dừng nhận diện giọng nói" : "Nhận diện giọng nói realtime"}
      className={cn(
        "shrink-0 transition-colors",
        scribe.isConnected
          ? "text-destructive hover:text-destructive bg-destructive/10 hover:bg-destructive/20 animate-pulse"
          : "text-muted-foreground hover:text-primary",
        className
      )}
    >
      {connecting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : scribe.isConnected ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </Button>
  );
}
