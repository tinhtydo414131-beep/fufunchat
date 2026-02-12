import { useState, useRef } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TextToSpeechButtonProps {
  text: string;
  isMe: boolean;
}

export function TextToSpeechButton({ text, isMe }: TextToSpeechButtonProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    if (!text?.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPlaying(true);
    } catch (err) {
      console.error("TTS error:", err);
      toast.error("Không thể đọc tin nhắn");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      title={playing ? "Dừng đọc" : "Đọc tin nhắn"}
      className={cn(
        "p-0.5 rounded transition-colors",
        isMe
          ? "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/15"
          : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted"
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : playing ? (
        <Square className="w-3 h-3" />
      ) : (
        <Volume2 className="w-3 h-3" />
      )}
    </button>
  );
}
