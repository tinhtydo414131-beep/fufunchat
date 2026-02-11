import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, Square, Send, X, SwitchCamera, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hapticsImpact, hapticsNotification } from "@/lib/haptics";

interface VideoRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoReady: (blob: Blob) => void;
}

export function VideoRecorderDialog({ open, onOpenChange, onVideoReady }: VideoRecorderDialogProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }
      setCameraReady(true);
    } catch {
      toast.error("Không thể truy cập camera");
      onOpenChange(false);
    }
  }, [onOpenChange]);

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      setRecordedBlob(null);
      setRecordedUrl(null);
      setRecording(false);
      setDuration(0);
      startCamera(facingMode);
    } else {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setCameraReady(false);
    }
  }, [open]);

  const switchCamera = () => {
    if (recording) return;
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      // Stop camera preview
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setDuration(0);
    hapticsImpact();
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
    hapticsNotification();
  };

  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    startCamera(facingMode);
  };

  const sendVideo = () => {
    if (recordedBlob) {
      onVideoReady(recordedBlob);
      onOpenChange(false);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
        <DialogTitle className="sr-only">Quay video</DialogTitle>
        <div className="relative w-full aspect-[9/16] max-h-[80vh] bg-black flex items-center justify-center">
          {/* Camera preview */}
          {!recordedUrl && (
            <video
              ref={videoPreviewRef}
              className={cn(
                "w-full h-full object-cover",
                facingMode === "user" && "scale-x-[-1]"
              )}
              muted
              playsInline
            />
          )}

          {/* Recorded playback */}
          {recordedUrl && (
            <video
              ref={videoPlaybackRef}
              src={recordedUrl}
              className="w-full h-full object-cover"
              controls
              autoPlay
              loop
              playsInline
            />
          )}

          {/* Loading state */}
          {!cameraReady && !recordedUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Recording indicator */}
          {recording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-medium">{fmt(duration)}</span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Controls */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
            {!recordedUrl ? (
              <>
                {/* Switch camera */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={switchCamera}
                  disabled={recording}
                  className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                >
                  <SwitchCamera className="w-6 h-6" />
                </Button>

                {/* Record / Stop */}
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={!cameraReady}
                  className={cn(
                    "w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all",
                    recording ? "bg-transparent" : "bg-red-500 hover:bg-red-600"
                  )}
                >
                  {recording ? (
                    <Square className="w-6 h-6 text-red-500 fill-red-500" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-500" />
                  )}
                </button>

                {/* Placeholder for symmetry */}
                <div className="w-12 h-12" />
              </>
            ) : (
              <>
                {/* Retake */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={retake}
                  className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                >
                  <RotateCcw className="w-6 h-6" />
                </Button>

                {/* Send */}
                <Button
                  type="button"
                  onClick={sendVideo}
                  className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                  size="icon"
                >
                  <Send className="w-6 h-6" />
                </Button>

                {/* Placeholder for symmetry */}
                <div className="w-12 h-12" />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
