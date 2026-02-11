import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VoiceRecordingWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const BAR_COUNT = 32;

export function VoiceRecordingWaveform({ stream, isRecording }: VoiceRecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.05));

  // Setup analyser when stream changes
  useEffect(() => {
    if (!stream || !isRecording) {
      setBars(Array(BAR_COUNT).fill(0.05));
      return;
    }

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      // Don't connect to destination — we don't want playback

      contextRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
    } catch {
      // Fallback: no analyser
    }

    return () => {
      if (contextRef.current?.state !== "closed") {
        contextRef.current?.close();
      }
      contextRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    };
  }, [stream, isRecording]);

  // Animation loop
  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const animate = () => {
      if (!analyserRef.current) {
        // Fallback: random bars
        setBars(Array.from({ length: BAR_COUNT }, () => 0.05 + Math.random() * 0.15));
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);

      const newBars: number[] = [];
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.min(i * step, data.length - 1);
        const val = data[idx] / 255;
        newBars.push(Math.max(0.06, val));
      }
      setBars(newBars);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording]);

  return (
    <div className="flex items-center gap-[2px] h-8 flex-1 px-1">
      {bars.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-full bg-destructive transition-all duration-75"
          style={{
            height: `${Math.max(12, val * 100)}%`,
            minHeight: "3px",
            opacity: 0.4 + val * 0.6,
          }}
        />
      ))}
    </div>
  );
}
