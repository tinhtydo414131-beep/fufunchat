import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

// Using Tenor's free API with the shared/public API key
const TENOR_API_KEY = "AIzaSyDqh-0U3bGCMGNWHaedNvPm6VKaKEhw3Ww";
const TENOR_BASE = "https://tenor.googleapis.com/v2";

interface TenorGif {
  id: string;
  media_formats: {
    tinygif?: { url: string };
    gif?: { url: string };
    mediumgif?: { url: string };
  };
  content_description: string;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ searchterm: string; image: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load trending/featured categories on mount
  useEffect(() => {
    inputRef.current?.focus();
    loadTrending();
    loadCategories();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=30&media_filter=tinygif,gif`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error("Failed to load trending GIFs", err);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`${TENOR_BASE}/categories?key=${TENOR_API_KEY}&type=trending`);
      const data = await res.json();
      setCategories((data.tags || []).slice(0, 8));
    } catch {
      // ignore
    }
  };

  const searchGifs = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      loadTrending();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${TENOR_BASE}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=30&media_filter=tinygif,gif`);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error("Failed to search GIFs", err);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(value), 400);
  };

  const getGifUrl = (gif: TenorGif) => {
    return gif.media_formats.gif?.url || gif.media_formats.mediumgif?.url || gif.media_formats.tinygif?.url || "";
  };

  const getPreviewUrl = (gif: TenorGif) => {
    return gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || "";
  };

  return (
    <div className="w-full sm:w-[340px] h-[360px] bg-popover border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Search header */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search GIFs..."
            className="pl-8 pr-8 h-8 text-sm bg-muted/50 border-0"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); loadTrending(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Category chips */}
      {!query && categories.length > 0 && (
        <div className="flex gap-1.5 px-2 py-1.5 overflow-x-auto no-scrollbar border-b border-border/30">
          {categories.map((cat) => (
            <button
              key={cat.searchterm}
              onClick={() => { setQuery(cat.searchterm); searchGifs(cat.searchterm); }}
              className="shrink-0 px-2.5 py-1 text-xs rounded-full bg-muted hover:bg-accent transition-colors font-medium text-muted-foreground"
            >
              {cat.searchterm}
            </button>
          ))}
        </div>
      )}

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No GIFs found
          </div>
        ) : (
          <div className="columns-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(getGifUrl(gif))}
                className="w-full mb-1.5 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all break-inside-avoid"
                title={gif.content_description}
              >
                <img
                  src={getPreviewUrl(gif)}
                  alt={gif.content_description}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="px-2 py-1 border-t border-border/30 text-center">
        <span className="text-[10px] text-muted-foreground">Powered by Tenor</span>
      </div>
    </div>
  );
}
