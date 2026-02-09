import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Save, Sparkles, Volume2, VolumeX, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useUserStatus, STATUS_EMOJI, type StatusType } from "@/hooks/useUserStatus";
import { useTranslation } from "@/hooks/useI18n";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { myStatus, updateStatus } = useUserStatus();
  const { t } = useTranslation();
  const [statusCustomText, setStatusCustomText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("notification_sound") !== "off";
  });

  useEffect(() => {
    if (!user) return;
    loadProfile();
    setStatusCustomText(myStatus.custom_text);
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, bio")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl(data.avatar_url || "");
      setBio(data.bio || "");
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(t("profile.uploadError"));
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success(t("profile.avatarUpdated"));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error(t("profile.saveError"));
    } else {
      toast.success(t("profile.saved"));
    }
    setSaving(false);
  };

  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "?";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold font-[Quicksand] flex items-center gap-2">
            {t("profile.title")} <Sparkles className="w-5 h-5 text-primary/60" />
          </h1>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative group">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              htmlFor="avatar-upload"
            >
              <Camera className="w-6 h-6 text-primary-foreground" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </div>
          {uploading && (
            <p className="text-xs text-muted-foreground">{t("profile.uploading")}</p>
          )}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("profile.personalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("profile.displayName")}</Label>
              <Input
                id="displayName"
                placeholder={t("profile.displayNamePlaceholder")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">{t("profile.bio")}</Label>
              <Textarea
                id="bio"
                placeholder={t("profile.bioPlaceholder")}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? t("profile.saving") : t("profile.save")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("profile.status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["online", "away", "busy", "offline"] as StatusType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    myStatus.status === s
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span>{STATUS_EMOJI[s]}</span>
                  <span>{t(`status.${s}`)}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customStatus">{t("profile.customStatus")}</Label>
              <div className="flex gap-2">
                <Input
                  id="customStatus"
                  placeholder={t("profile.customPlaceholder")}
                  value={statusCustomText}
                  onChange={(e) => setStatusCustomText(e.target.value)}
                  maxLength={50}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    updateStatus(myStatus.status, statusCustomText);
                    toast.success(t("profile.statusUpdated"));
                  }}
                >
                  {t("chat.save")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("profile.settingsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {soundEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{t("profile.notifSound")}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.notifSoundDesc")}</p>
                </div>
              </div>
              <Switch
                checked={soundEnabled}
                onCheckedChange={(checked) => {
                  setSoundEnabled(checked);
                  localStorage.setItem("notification_sound", checked ? "on" : "off");
                  toast.success(checked ? t("profile.soundOn") : t("profile.soundOff"));
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium">{t("profile.darkMode")}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.darkModeDesc")}</p>
                </div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => {
                  setTheme(checked ? "dark" : "light");
                  toast.success(checked ? t("profile.darkOn") : t("profile.darkOff"));
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
