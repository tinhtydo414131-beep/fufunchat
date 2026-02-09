import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { Moon, Sun, Volume2, Type, Globe } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FONT_SIZE_KEY = "chat_font_size";
const SOUND_KEY = "notification_sound";
const LANG_KEY = "app_language";

export function getStoredFontSize(): number {
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  return stored ? parseInt(stored, 10) : 14;
}

export function getStoredLanguage(): string {
  return localStorage.getItem(LANG_KEY) || "vi";
}

const LANGUAGES = [
  { value: "vi", label: "Tiếng Việt 🇻🇳" },
  { value: "en", label: "English 🇺🇸" },
  { value: "ja", label: "日本語 🇯🇵" },
  { value: "ko", label: "한국어 🇰🇷" },
  { value: "zh", label: "中文 🇨🇳" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();

  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off"
  );
  const [fontSize, setFontSize] = useState(() => getStoredFontSize());
  const [language, setLanguage] = useState(() => getStoredLanguage());

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

  // Set CSS var on mount
  useEffect(() => {
    document.documentElement.style.setProperty("--chat-font-size", `${getStoredFontSize()}px`);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
                <p className="text-xs text-muted-foreground">
                  {fontSize}px
                </p>
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
