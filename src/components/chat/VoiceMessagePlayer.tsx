import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceMessagePlayerProps {
  src: string;
  isMe: boolean;
}

const BAR_COUNT = 28;
const SPEEDS = [1, 1.5, 2] as const;

export function VoiceMessagePlayer({ src, isMe }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.25)
  );
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Generate static waveform pattern from duration seed
  const staticBars = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, (_, i) => {
      const x = i / BAR_COUNT;
      return 0.2 + 0.6 * Math.abs(Math.sin(x * Math.PI * 3.5 + 0.7)) * (0.5 + Math.random() * 0.5);
    })
  );

  const setupAnalyser = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || sourceNodeRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      contextRef.current = ctx;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
    } catch {
      // Fallback: no analyser
    }
  }, []);

  const animate = useCallback(() => {
    if (!analyserRef.current) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const newBars: number[] = [];
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
    for (let i = 0; i < BAR_COUNT; i++) {
      const val = data[Math.min(i * step, data.length - 1)] / 255;
      newBars.push(Math.max(0.08, val));
    }
    setBars(newBars);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
    } else {
      setupAnalyser();
      await audio.play();
      setPlaying(true);
      animFrameRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime / (audio.duration || 1));
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      cancelAnimationFrame(animFrameRef.current);
      setBars(staticBars.current);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleTranscribe = async () => {
    if (transcribing || transcript !== null) return;
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-transcribe", {
        body: { audio_url: src },
      });
      if (error) throw error;
      if (data?.text) {
        setTranscript(data.text);
      } else {
        toast.error("Không thể nhận diện giọng nói");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      toast.error("Lỗi khi chuyển giọng nói thành văn bản");
    } finally {
      setTranscribing(false);
    }
  };

  const displayBars = playing ? bars : staticBars.current;

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[280px]">
      <div className="flex items-center gap-2.5">
        <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
            isMe
              ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
              : "bg-primary/15 hover:bg-primary/25 text-primary"
          )}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Waveform + time */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-end gap-[2px] h-7 cursor-pointer" onClick={seek}>
            {displayBars.map((val, i) => {
              const filled = i / BAR_COUNT <= progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all",
                    playing ? "duration-75" : "duration-300",
                    filled
                      ? isMe ? "bg-primary-foreground" : "bg-primary"
                      : isMe ? "bg-primary-foreground/30" : "bg-primary/25"
                  )}
                  style={{ height: `${Math.max(8, val * 100)}%`, minHeight: "3px" }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-medium", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {playing ? fmt(audioRef.current?.currentTime || 0) : fmt(duration)}
            </span>
            <div className="flex items-center gap-1">
              {/* Transcribe button */}
              <button
                onClick={handleTranscribe}
                disabled={transcribing || transcript !== null}
                title={transcript !== null ? "Đã chuyển đổi" : "Chuyển thành văn bản"}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  transcript !== null
                    ? isMe ? "text-primary-foreground/50" : "text-muted-foreground/50"
                    : isMe
                      ? "text-primary-foreground/70 hover:bg-primary-foreground/15"
                      : "text-muted-foreground hover:bg-muted"
                )}
              >
                {transcribing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={cycleSpeed}
                className={cn(
                  "text-[10px] font-bold rounded px-1 py-0.5 transition-colors",
                  isMe
                    ? "text-primary-foreground/70 hover:bg-primary-foreground/15"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {speed}x
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript display */}
      {transcript && (
        <div
          className={cn(
            "text-[11px] leading-relaxed px-2 py-1.5 rounded-lg",
            isMe
              ? "bg-primary-foreground/10 text-primary-foreground/90"
              : "bg-muted/60 text-foreground/80"
          )}
        >
          {transcript}
        </div>
      )}
    </div>
  );
}
