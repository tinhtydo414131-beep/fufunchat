import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { Moon, Sun, Volume2, Type, Globe, Wallpaper, Check, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FONT_SIZE_KEY = "chat_font_size";
const SOUND_KEY = "notification_sound";
const LANG_KEY = "app_language";
const WALLPAPER_KEY = "chat_wallpaper";

export function getStoredFontSize(): number {
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 14;
}

export function getStoredLanguage(): string {
  return localStorage.getItem(LANG_KEY) || "vi";
}

export function getStoredWallpaper(): string {
  return localStorage.getItem(WALLPAPER_KEY) || "none";
}

/** Returns true if the wallpaper value is a custom uploaded image */
export function isCustomWallpaper(value: string): boolean {
  return value.startsWith("custom:");
}

/** Extracts the URL from a custom wallpaper value */
export function getCustomWallpaperUrl(value: string): string {
  return value.slice("custom:".length);
}

export const WALLPAPERS: {
  id: string;
  label: string;
  gradient?: string;
  size?: string;
}[] = [
  { id: "none", label: "Mặc định" },
  { id: "dots", label: "Chấm bi", gradient: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.08) 1px, transparent 1px)", size: "16px 16px" },
  { id: "grid", label: "Lưới", gradient: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)", size: "24px 24px" },
  { id: "diagonal", label: "Sọc chéo", gradient: "repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--muted-foreground) / 0.04) 10px, hsl(var(--muted-foreground) / 0.04) 11px)" },
  { id: "bubbles", label: "Bong bóng", gradient: "radial-gradient(circle at 20% 50%, hsl(var(--fun-pink) / 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--fun-mint) / 0.15) 0%, transparent 50%), radial-gradient(circle at 60% 80%, hsl(var(--fun-lavender) / 0.15) 0%, transparent 50%)" },
  { id: "warm", label: "Ấm áp", gradient: "linear-gradient(135deg, hsl(var(--fun-gold) / 0.12) 0%, hsl(var(--fun-pink) / 0.08) 50%, hsl(var(--fun-lavender) / 0.1) 100%)" },
  { id: "ocean", label: "Đại dương", gradient: "linear-gradient(180deg, hsl(var(--fun-mint) / 0.1) 0%, hsl(var(--background)) 40%, hsl(var(--fun-lavender) / 0.08) 100%)" },
];

const LANGUAGES = [
  { value: "vi", label: "Tiếng Việt 🇻🇳" },
  { value: "en", label: "English 🇺🇸" },
  { value: "ja", label: "日本語 🇯🇵" },
  { value: "ko", label: "한국어 🇰🇷" },
  { value: "zh", label: "中文 🇨🇳" },
];

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off"
  );
  const [fontSize, setFontSize] = useState(() => getStoredFontSize());
  const [language, setLanguage] = useState(() => getStoredLanguage());
  const [wallpaper, setWallpaper] = useState(() => getStoredWallpaper());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
    document.documentElement.style.setProperty("--chat-font-size", `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(WALLPAPER_KEY, wallpaper);
    window.dispatchEvent(new CustomEvent("wallpaper-change", { detail: wallpaper }));
  }, [wallpaper]);

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-font-size", `${getStoredFontSize()}px`);
  }, []);

  const handleUploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh JPG, PNG, WebP, GIF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Ảnh phải nhỏ hơn 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/wallpaper-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("wallpapers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("wallpapers")
        .getPublicUrl(filePath);

      setWallpaper(`custom:${urlData.publicUrl}`);
      toast.success("Đã tải hình nền lên! 🎨");
    } catch (err: any) {
      console.error("Wallpaper upload error:", err);
      toast.error("Không thể tải ảnh lên — thử lại nhé");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeCustomWallpaper = () => {
    setWallpaper("none");
  };

  const hasCustomWallpaper = isCustomWallpaper(wallpaper);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold font-[Quicksand]">
            Cài đặt ⚙️
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
              <div>
                <Label className="text-sm font-semibold">Chế độ tối</Label>
                <p className="text-xs text-muted-foreground">Chuyển giao diện sáng / tối</p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>

          <Separator />

          {/* Notification Sound */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Âm thanh thông báo</Label>
                <p className="text-xs text-muted-foreground">Phát âm thanh khi có tin nhắn mới</p>
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>

          <Separator />

          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Cỡ chữ tin nhắn</Label>
                <p className="text-xs text-muted-foreground">{fontSize}px</p>
              </div>
            </div>
            <Slider
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
              min={12}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>Nhỏ</span>
              <span>Lớn</span>
            </div>
          </div>

          <Separator />

          {/* Wallpaper */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Wallpaper className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Hình nền trò chuyện</Label>
                <p className="text-xs text-muted-foreground">Chọn hình nền hoặc tải ảnh lên</p>
              </div>
            </div>

            {/* Preset wallpapers */}
            <div className="grid grid-cols-4 gap-2">
              {WALLPAPERS.map((wp) => {
                const isSelected = !hasCustomWallpaper && wallpaper === wp.id;
                const previewStyle: React.CSSProperties = {};
                if (wp.gradient) {
                  previewStyle.backgroundImage = wp.gradient;
                  if (wp.size) previewStyle.backgroundSize = wp.size;
                }
                return (
                  <button
                    key={wp.id}
                    onClick={() => setWallpaper(wp.id)}
                    className={cn(
                      "relative h-16 rounded-lg border-2 transition-all overflow-hidden",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                    title={wp.label}
                  >
                    <div className="absolute inset-0 bg-background" style={previewStyle} />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="absolute bottom-0.5 inset-x-0 text-[9px] text-center text-muted-foreground font-medium">
                      {wp.label}
                    </span>
                  </button>
                );
              })}

              {/* Custom upload tile */}
              {hasCustomWallpaper ? (
                <button
                  className="relative h-16 rounded-lg border-2 border-primary ring-2 ring-primary/20 overflow-hidden"
                  title="Ảnh tùy chỉnh"
                >
                  <img
                    src={getCustomWallpaperUrl(wallpaper)}
                    alt="Custom wallpaper"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomWallpaper();
                    }}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground"
                    title="Xóa ảnh nền"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    "relative h-16 rounded-lg border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center gap-0.5",
                    "border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                  title="Tải ảnh lên"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {uploading ? "Đang tải..." : "Tải ảnh"}
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleUploadWallpaper}
            />
          </div>

          <Separator />

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Ngôn ngữ</Label>
                <p className="text-xs text-muted-foreground">Chọn ngôn ngữ hiển thị</p>
              </div>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
