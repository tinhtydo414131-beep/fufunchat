import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { STATUS_EMOJI, type StatusType } from "@/hooks/useUserStatus";
import { useTranslation } from "@/hooks/useI18n";

interface UserProfilePopupProps {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  children: React.ReactNode;
}

interface ProfileData {
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface UserStatusData {
  status: StatusType;
  custom_text: string;
}

export function UserProfilePopup({ userId, displayName, avatarUrl, isOnline, children }: UserProfilePopupProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatusData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url, bio, created_at")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });

    supabase
      .from("user_statuses")
      .select("status, custom_text")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setUserStatus({ status: data.status as StatusType, custom_text: data.custom_text || "" });
      });
  }, [open, userId]);

  const { t } = useTranslation();
  const name = profile?.display_name || displayName || t("chat.user");
  const avatar = profile?.avatar_url || avatarUrl;
  const initials = name.slice(0, 2).toUpperCase();

  const STATUS_KEY_MAP: Record<StatusType, string> = {
    online: "chat.active",
    away: "chat.away",
    busy: "chat.busy",
    offline: "chat.offline",
  };

  const statusLabel = userStatus
    ? `${STATUS_EMOJI[userStatus.status]} ${t(STATUS_KEY_MAP[userStatus.status])}`
    : isOnline ? `🟢 ${t("chat.active")}` : `⚫ ${t("chat.offline")}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer focus:outline-none">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 p-0 overflow-hidden">
        {/* Banner */}
        <div className="h-16 bg-gradient-to-br from-primary/40 to-primary/10" />
        {/* Avatar overlapping banner */}
        <div className="px-4 -mt-8">
          <div className="relative inline-block">
            <Avatar className="w-16 h-16 border-4 border-popover">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isOnline !== undefined && (
              <span
                className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-popover ${
                  isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
            )}
          </div>
        </div>
        {/* Info */}
        <div className="px-4 pt-2 pb-4 space-y-2">
          <div>
            <p className="font-semibold text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{statusLabel}</p>
          </div>
          {userStatus?.custom_text && (
            <p className="text-xs text-muted-foreground italic">"{userStatus.custom_text}"</p>
          )}
          {profile?.bio && (
            <p className="text-xs text-muted-foreground leading-relaxed">{profile.bio}</p>
          )}
          {profile?.created_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
              <Clock className="w-3 h-3" />
              <span>{t("profile.joinedAt")} {format(new Date(profile.created_at), "dd/MM/yyyy")}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
