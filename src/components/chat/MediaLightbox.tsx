import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface MediaLightboxProps {
  media: MediaItem[];
  currentIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ media, currentIndex, onClose }: MediaLightboxProps) {
  const [index, setIndex] = useState(currentIndex);
  const [scale, setScale] = useState(1);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

  const current = media[index];

  const goPrev = useCallback(() => {
    setScale(1);
    setIndex((i) => (i > 0 ? i - 1 : media.length - 1));
  }, [media.length]);

  const goNext = useCallback(() => {
    setScale(1);
    setIndex((i) => (i < media.length - 1 ? i + 1 : 0));
  }, [media.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  // Swipe on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (touchDelta.current > 60) goPrev();
    else if (touchDelta.current < -60) goNext();
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = current.url;
    a.download = `media-${index + 1}`;
    a.target = "_blank";
    a.click();
  };

  const isVideo = current.type === "video";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-sm font-medium">
          {index + 1} / {media.length}
        </span>
        <div className="flex items-center gap-1">
          {!isVideo && (
            <>
              <button
                onClick={() => setScale((s) => Math.min(s + 0.5, 3))}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setScale((s) => Math.max(s - 0.5, 0.5))}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Media area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={onClose}
      >
        {/* Prev button */}
        {media.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {isVideo ? (
          <video
            key={index}
            src={current.url}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[80vh] rounded-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            key={index}
            src={current.url}
            alt={`Image ${index + 1}`}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200 select-none"
            style={{ transform: `scale(${scale})`, transition: "transform 0.2s ease" }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        )}

        {/* Next button */}
        {media.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 overflow-x-auto">
          {media.map((item, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setScale(1); }}
              className={cn(
                "w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 relative",
                i === index
                  ? "border-primary ring-1 ring-primary scale-110"
                  : "border-transparent opacity-50 hover:opacity-80"
              )}
            >
              {item.type === "video" ? (
                <>
                  <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
                    </div>
                  </div>
                </>
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
