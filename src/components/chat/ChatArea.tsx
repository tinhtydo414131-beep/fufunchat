import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Paperclip, Image as ImageIcon, X, FileText, Download, Users, Settings, Reply, Trash2, Undo2, Search, ChevronUp, ChevronDown, Mic, Square, Play, Pause, Forward, Pin, PinOff, Pencil, Check, CheckCheck, BellOff, Bell, Clock, Phone, Video, Timer, TimerOff, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { EmojiPicker } from "./EmojiPicker";
import { TypingIndicator } from "./TypingIndicator";
import { GroupManagementDialog } from "./GroupManagementDialog";
import { MessageReactions } from "./MessageReactions";
import { UserProfilePopup } from "./UserProfilePopup";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { SwipeToReply } from "./SwipeToReply";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { MobileLongPressMenu } from "./MobileLongPressMenu";
import { MessageContextMenu } from "./MessageContextMenu";
import { MediaLightbox } from "./MediaLightbox";
import { GifPicker } from "./GifPicker";
import { useConfetti, isCelebrationMessage, useSnow, isSnowMessage, useFire, isFireMessage } from "./ConfettiEffect";

const ANGRY_EMOJIS = ["😡", "🤬", "😤", "💢", "👿", "😠"];
function isAngryMessage(content: string | null): boolean {
  if (!content) return false;
  return ANGRY_EMOJIS.some((e) => content.includes(e));
}
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { playNotificationSound } from "@/lib/notificationSound";
import { markConversationRead } from "./ConversationList";
import { useUserStatus, STATUS_EMOJI } from "@/hooks/useUserStatus";
import { getStoredWallpaper, WALLPAPERS, isCustomWallpaper, getCustomWallpaperUrl, getStoredWallpaperOpacity } from "./SettingsDialog";
import { useTranslation } from "@/hooks/useI18n";

const LANGUAGE_FLAGS: Record<string, string> = {
  vi: "🇻🇳", en: "🇺🇸", es: "🇪🇸", pt: "🇧🇷", hi: "🇮🇳",
  ar: "🇸🇦", he: "🇮🇱", fa: "🇮🇷", tr: "🇹🇷",
  ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳",
};

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  reply_to: string | null;
  sender?: { display_name: string; avatar_url: string | null; language?: string | null };
}

interface ChatAreaProps {
  conversationId: string | null;
  isOnline: (userId: string) => boolean;
  onStartCall?: (conversationId: string, callType: "voice" | "video") => void;
  onSendPush?: (conversationId: string, title: string, body: string) => void;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];

function isImageUrl(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

function getFileName(url: string) {
  const path = url.split("?")[0];
  const parts = path.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "file");
}

export function ChatArea({ conversationId, isOnline, onStartCall, onSendPush }: ChatAreaProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { sendNotification } = useNotifications();
  const { getUserStatus, statusMap } = useUserStatus();
  const { trigger: triggerConfetti, element: confettiElement } = useConfetti();
  const { trigger: triggerSnow, element: snowElement } = useSnow();
  const { trigger: triggerFire, element: fireElement } = useFire();
  const [otherUserStatus, setOtherUserStatus] = useState<{ status: string; custom_text: string } | null>(null);
  const [shaking, setShaking] = useState(false);
  const triggerShake = () => { setShaking(true); setTimeout(() => setShaking(false), 550); };
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [convInfo, setConvInfo] = useState<{ type: string; name: string | null; memberCount: number; otherUserId?: string; otherUserName?: string; disappearAfter?: number | null; announcement?: string | null; description?: string | null } | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [disappearMenuOpen, setDisappearMenuOpen] = useState(false);
  const [groupManagementOpen, setGroupManagementOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [readReceipts, setReadReceipts] = useState<{ user_id: string; last_read_at: string; display_name: string; avatar_url: string | null }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const isMutedRef = useRef(false);
  const dragCounterRef = useRef(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [wallpaperId, setWallpaperId] = useState(() => getStoredWallpaper());
  const [wallpaperOpacity, setWallpaperOpacity] = useState(() => getStoredWallpaperOpacity());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for wallpaper changes from settings
  useEffect(() => {
    const handler = (e: Event) => setWallpaperId((e as CustomEvent).detail);
    const opacityHandler = (e: Event) => setWallpaperOpacity((e as CustomEvent).detail);
    window.addEventListener("wallpaper-change", handler);
    window.addEventListener("wallpaper-opacity-change", opacityHandler);
    return () => {
      window.removeEventListener("wallpaper-change", handler);
      window.removeEventListener("wallpaper-opacity-change", opacityHandler);
    };
  }, []);

  // Upsert own read receipt when opening conversation
  const updateReadReceipt = useCallback(async () => {
    if (!conversationId || !user) return;
    const now = new Date().toISOString();
    await supabase
      .from("message_reads")
      .upsert(
        { conversation_id: conversationId, user_id: user.id, last_read_at: now },
        { onConflict: "conversation_id,user_id" }
      );
  }, [conversationId, user]);

  // Load other users' read receipts
  const loadReadReceipts = useCallback(async () => {
    if (!conversationId || !user) return;
    const { data } = await supabase
      .from("message_reads")
      .select("user_id, last_read_at")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id);
    if (data && data.length > 0) {
      const latest = data.reduce((a, b) => a.last_read_at > b.last_read_at ? a : b);
      setOtherReadAt(latest.last_read_at);

      // Load profiles for all readers
      const userIds = data.map((d) => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      setReadReceipts(
        data.map((d) => ({
          ...d,
          display_name: profileMap.get(d.user_id)?.display_name || "User",
          avatar_url: profileMap.get(d.user_id)?.avatar_url || null,
        }))
      );
    } else {
      setOtherReadAt(null);
      setReadReceipts([]);
    }
  }, [conversationId, user]);

  // Load other user's status when convInfo changes
  useEffect(() => {
    if (convInfo?.otherUserId) {
      getUserStatus(convInfo.otherUserId).then(setOtherUserStatus);
    } else {
      setOtherUserStatus(null);
    }
  }, [convInfo?.otherUserId, statusMap]);

  const loadPinnedMessages = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("pinned_messages")
      .select("message_id")
      .eq("conversation_id", conversationId);
    if (data) {
      setPinnedMessageIds(new Set(data.map((p) => p.message_id)));
    }
  }, [conversationId]);

  const pinMessage = async (msgId: string) => {
    if (!conversationId || !user) return;
    const { error } = await supabase.from("pinned_messages").insert({
      conversation_id: conversationId,
      message_id: msgId,
      pinned_by: user.id,
    });
    if (error) {
      toast.error(t("chat.pinError"));
    } else {
      toast.success(t("chat.pinSuccess"));
    }
  };

  const unpinMessage = async (msgId: string) => {
    if (!conversationId) return;
    const { error } = await supabase
      .from("pinned_messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("message_id", msgId);
    if (error) {
      toast.error(t("chat.unpinError"));
    } else {
      toast.success(t("chat.unpinSuccess"));
    }
  };

  // Load mute status
  const loadMuteStatus = useCallback(async () => {
    if (!conversationId || !user) return;
    const { data } = await supabase
      .from("conversation_members")
      .select("muted")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    const val = data?.muted ?? false;
    setIsMuted(val);
    isMutedRef.current = val;
  }, [conversationId, user]);

  const toggleMute = async () => {
    if (!conversationId || !user) return;
    const newVal = !isMuted;
    setIsMuted(newVal);
    isMutedRef.current = newVal;
    await supabase
      .from("conversation_members")
      .update({ muted: newVal })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    toast.success(newVal ? t("chat.mutedSuccess") || "🔕" : t("chat.unmutedSuccess") || "🔔");
  };

  const DISAPPEAR_OPTIONS = [
    { label: "Off", value: null },
    { label: "30s", value: 30 },
    { label: "5m", value: 300 },
    { label: "1h", value: 3600 },
    { label: "24h", value: 86400 },
    { label: "7d", value: 604800 },
  ];

  const getExpiresAt = (): string | null => {
    if (!convInfo?.disappearAfter) return null;
    return new Date(Date.now() + convInfo.disappearAfter * 1000).toISOString();
  };

  const setDisappearAfter = async (value: number | null) => {
    if (!conversationId) return;
    await supabase
      .from("conversations")
      .update({ disappear_after: value } as any)
      .eq("id", conversationId);
    setConvInfo((prev) => prev ? { ...prev, disappearAfter: value } : prev);
    setDisappearMenuOpen(false);
    toast.success(value ? `⏱️ Messages will disappear after ${DISAPPEAR_OPTIONS.find((o) => o.value === value)?.label}` : "⏱️ Disappearing messages turned off");
  };

  useEffect(() => {
    if (!conversationId) return;
    if (user) markConversationRead(user.id, conversationId);
    updateReadReceipt();
    loadMessages();
    loadConvInfo();
    loadReadReceipts();
    loadPinnedMessages();
    loadMuteStatus();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url, language")
            .eq("user_id", newMsg.sender_id)
            .single();

          // Send browser notification for messages from others
          if (newMsg.sender_id !== user?.id && !isMutedRef.current) {
            playNotificationSound();
            const senderName = profile?.display_name || t("chat.user");
            const body = newMsg.type === "text" ? (newMsg.content || "") : newMsg.type === "image" ? "📷" : "📎";
            sendNotification(`${senderName}`, { body, tag: `msg-${newMsg.id}` });
            // Update own read receipt since we're viewing this conversation
            updateReadReceipt();
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: profile || undefined }];
          });

          // Trigger confetti for incoming celebration messages
          if (isCelebrationMessage(newMsg.content)) triggerConfetti();
          if (isAngryMessage(newMsg.content)) triggerShake();
          if (isSnowMessage(newMsg.content)) triggerSnow();
          if (isFireMessage(newMsg.content)) triggerFire();
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, displayName } = payload.payload as { userId: string; displayName: string };
        if (userId === user?.id) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(userId, displayName);
          return next;
        });
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }, 3000);
      })
      .subscribe();

    // Listen for read receipt updates
    const readChannel = supabase
      .channel(`reads:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reads",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadReadReceipts();
        }
      )
      .subscribe();

    // Listen for pinned messages updates
    const pinChannel = supabase
      .channel(`pins:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pinned_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadPinnedMessages();
        }
      )
      .subscribe();

    // Listen for conversation updates (announcements, name, description)
    const convChannel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as any;
          setConvInfo((prev) => {
            if (!prev) return prev;
            // Play sound if announcement changed and is not empty
            if (updated.announcement && updated.announcement !== prev.announcement) {
              playNotificationSound();
              toast("📢 New Announcement", {
                description: updated.announcement,
                action: { label: "View", onClick: () => {
                  document.getElementById("announcement-banner")?.scrollIntoView({ behavior: "smooth" });
                }},
              });
            }
            return {
              ...prev,
              announcement: updated.announcement || null,
              description: updated.description || null,
              name: updated.name || prev.name,
            };
          });
          setAnnouncementDismissed(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(readChannel);
      supabase.removeChannel(pinChannel);
      supabase.removeChannel(convChannel);
    };
  }, [conversationId, user?.id]);

  // Auto-dismiss announcement banner after 30s for non-admin users
  useEffect(() => {
    if (!convInfo?.announcement || announcementDismissed || isAdmin) return;
    const timer = setTimeout(() => setAnnouncementDismissed(true), 30000);
    return () => clearTimeout(timer);
  }, [convInfo?.announcement, announcementDismissed, isAdmin]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = messages
      .filter((m) => !m.is_deleted && m.type === "text" && m.content?.toLowerCase().includes(q))
      .map((m) => m.id);
    setSearchResults(results);
    setSearchIndex(results.length > 0 ? results.length - 1 : 0);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResults.length > 0 && searchResults[searchIndex]) {
      document.getElementById(`msg-${searchResults[searchIndex]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchIndex, searchResults]);

  const toggleSearch = () => {
    setSearchOpen((prev) => {
      if (!prev) setTimeout(() => searchInputRef.current?.focus(), 100);
      return !prev;
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    setLoading(true);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, language")
        .in("user_id", senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      setMessages(
        data.map((m) => ({
          ...m,
          sender: profileMap.get(m.sender_id) || undefined,
        }))
      );
    }
    setLoading(false);
  };

  const loadConvInfo = async () => {
    if (!conversationId || !user) return;
    const { data: conv } = await supabase
      .from("conversations")
      .select("type, name, disappear_after, description, announcement")
      .eq("id", conversationId)
      .maybeSingle();

    // Check if current user is admin
    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    setIsAdmin(memberData?.role === "admin");

    const { count } = await supabase
      .from("conversation_members")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    let otherUserId: string | undefined;
    let otherUserName: string | undefined;
    if (conv?.type === "direct") {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id)
        .limit(1);
      if (members && members.length > 0) {
        otherUserId = members[0].user_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", otherUserId)
          .maybeSingle();
        otherUserName = profile?.display_name || undefined;
      }
    }

    if (conv) {
      setConvInfo({ type: conv.type, name: conv.name, memberCount: count || 0, otherUserId, otherUserName, disappearAfter: (conv as any).disappear_after, announcement: (conv as any).announcement, description: (conv as any).description });
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user || !conversationId) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { upsert: false });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && pendingFiles.length === 0) || !conversationId || !user || sending) return;

    setSending(true);

    try {
      // Upload pending files first
      if (pendingFiles.length > 0) {
        setUploading(true);
        for (const file of pendingFiles) {
          const url = await uploadFile(file);
          if (!url) {
            toast.error(`${file.name} - upload failed`);
            continue;
          }

          const isImage = file.type.startsWith("image/");
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: url,
            type: isImage ? "image" : "file",
            reply_to: replyTo?.id || null,
            expires_at: getExpiresAt(),
          } as any);
        }
        setPendingFiles([]);
        setUploading(false);
      }

      // Send text message if any
      if (newMessage.trim()) {
        const content = newMessage.trim();
        setNewMessage("");
        const { error } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          type: "text",
          reply_to: replyTo?.id || null,
          expires_at: getExpiresAt(),
        } as any);
        if (error) setNewMessage(content);
        else {
          if (isCelebrationMessage(content)) triggerConfetti();
          if (isAngryMessage(content)) triggerShake();
          if (isSnowMessage(content)) triggerSnow();
          if (isFireMessage(content)) triggerFire();
          // Send push notification to other members
          const senderName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Someone";
          onSendPush?.(conversationId, senderName, content.length > 100 ? content.slice(0, 100) + "…" : content);
        }
      }

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } finally {
      setSending(false);
      setReplyTo(null);
      inputRef.current?.focus();
    }
  };

  const scheduleMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user || !scheduleDate || !scheduleTime) {
      toast.error(t("chat.scheduleError"));
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast.error(t("chat.scheduleError"));
      return;
    }

    // @ts-ignore - table exists but not yet in generated types
    const { error } = await supabase.from("scheduled_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: newMessage.trim(),
      type: "text",
      reply_to: replyTo?.id || null,
      scheduled_at: scheduledAt.toISOString(),
    });

    if (error) {
      console.error("Schedule message error:", error);
      toast.error(t("chat.scheduleError"));
    } else {
      toast.success(`${t("chat.scheduleSuccess")} ${format(scheduledAt, "HH:mm dd/MM/yyyy")} ⏰`);
      setNewMessage("");
      setReplyTo(null);
      setScheduleOpen(false);
      setScheduleDate("");
      setScheduleTime("");
    }
  };

  const broadcastTyping = useCallback(() => {
    if (!conversationId || !user) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;

    supabase.channel(`typing:${conversationId}`).send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: user.id,
        displayName: user.user_metadata?.display_name || user.email?.split("@")[0] || t("chat.user"),
      },
    });
  }, [conversationId, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    broadcastTyping();
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const maxSize = 20 * 1024 * 1024;
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name} ${t("chat.fileTooLarge")}`);
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) {
          toast.error(t("chat.voiceTooShort"));
          return;
        }
        await sendVoiceMessage(blob);
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      toast.error(t("chat.voiceError"));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!conversationId || !user) return;
    setSending(true);
    try {
      const path = `${conversationId}/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(path, blob, { contentType: "audio/webm" });

      if (uploadError) {
        toast.error(t("chat.voiceUploadFailed"));
        return;
      }

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: urlData.publicUrl,
        type: "voice",
        reply_to: replyTo?.id || null,
        expires_at: getExpiresAt(),
      } as any);

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setReplyTo(null);
      toast.success(t("chat.voiceSent"));
      const senderName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Someone";
      onSendPush?.(conversationId, senderName, "🎙️ Voice message");
    } finally {
      setSending(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const recallMessage = async (msg: Message) => {
    if (msg.sender_id !== user?.id) return;
    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true, content: null })
      .eq("id", msg.id);
    if (error) {
      toast.error(t("chat.recallError"));
    } else {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, is_deleted: true, content: null } : m));
      toast.success(t("chat.recallSuccess"));
    }
  };

  const saveEditMessage = async () => {
    if (!editingMsg || !editText.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: editText.trim(), updated_at: new Date().toISOString() })
      .eq("id", editingMsg.id);
    if (error) {
      toast.error(t("chat.editError"));
    } else {
      setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, content: editText.trim(), updated_at: new Date().toISOString() } : m));
      toast.success(t("chat.editSuccess"));
    }
    setEditingMsg(null);
    setEditText("");
  };

  const deleteMessage = async (msg: Message) => {
    if (msg.sender_id !== user?.id) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", msg.id);
    if (error) {
      toast.error(t("chat.deleteError"));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success(t("chat.deleteSuccess"));
    }
  };

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    if (msg.is_deleted) {
      return <span className="italic text-muted-foreground">{t("chat.deletedMessage")}</span>;
    }

    if (msg.type === "image" && msg.content) {
      return (
        <button
          type="button"
          onClick={() => setLightboxUrl(msg.content)}
          className="block"
        >
          <img
            src={msg.content}
            alt={t("chat.zoomedImage")}
            className="max-w-[260px] max-h-[300px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </button>
      );
    }

    if (msg.type === "file" && msg.content) {
      const fileName = getFileName(msg.content);
      return (
        <a
          href={msg.content}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl transition-colors",
            isMe ? "hover:bg-primary-foreground/10" : "hover:bg-foreground/5"
          )}
        >
          <FileText className="w-5 h-5 shrink-0" />
          <span className="text-sm truncate max-w-[180px]">{fileName}</span>
          <Download className="w-4 h-4 shrink-0 ms-auto" />
        </a>
      );
    }

    if (msg.type === "voice" && msg.content) {
      return <VoiceMessagePlayer src={msg.content} isMe={isMe} />;
    }

    return msg.content;
  };

  const typingNames = Array.from(typingUsers.values());

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{t("chat.welcome")}</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            {t("chat.welcomeSubtitle")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    {confettiElement}
    {snowElement}
    {fireElement}
    <div
      className={cn("flex-1 flex flex-col bg-background relative min-h-0", shaking && "screen-shake")}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        setIsDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        const maxSize = 20 * 1024 * 1024;
        const valid = files.filter((f) => {
          if (f.size > maxSize) {
            toast.error(`${f.name} ${t("chat.fileTooLarge")}`);
            return false;
          }
          return true;
        });
        if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
      }}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl pointer-events-none">
          <div className="text-center space-y-2">
            <Paperclip className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm font-medium text-primary">{t("chat.dropFiles")}</p>
          </div>
        </div>
      )}
      {/* Chat Header - Telegram style */}
      {convInfo && convInfo.type === "direct" && convInfo.otherUserId && (
        <div className="px-4 py-2.5 bg-primary text-primary-foreground flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {convInfo.otherUserName?.slice(0, 2).toUpperCase() || "??"}
            </div>
            {isOnline(convInfo.otherUserId) && (
              <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{convInfo.otherUserName || t("chat.user")}</p>
            <p className="text-xs text-primary-foreground/70">
              {typingNames.length > 0 ? (
                <span className="animate-pulse">{typingNames.join(", ")} typing...</span>
              ) : otherUserStatus
                ? `${STATUS_EMOJI[otherUserStatus.status as keyof typeof STATUS_EMOJI] || "⚫"} ${t({ online: "chat.active", away: "chat.away", busy: "chat.busy", offline: "chat.offline" }[otherUserStatus.status as string] || "chat.offline")}${otherUserStatus.custom_text ? ` · ${otherUserStatus.custom_text}` : ""}`
                : isOnline(convInfo.otherUserId) ? t("chat.active") : t("chat.offline")}
            </p>
          </div>
          {onStartCall && (
            <>
              <Button variant="ghost" size="icon" onClick={() => onStartCall(conversationId!, "voice")} title="Voice call" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onStartCall(conversationId!, "video")} title="Video call" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                <Video className="w-4 h-4" />
              </Button>
            </>
          )}
           <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? t("chat.enableNotif") : t("chat.disableNotif")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </Button>
          <Popover open={disappearMenuOpen} onOpenChange={setDisappearMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Disappearing messages" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                {convInfo.disappearAfter ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4 opacity-70" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5" align="end" side="bottom">
              <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Disappearing messages</p>
              {DISAPPEAR_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setDisappearAfter(opt.value)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                    convInfo.disappearAfter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggleSearch} title={t("chat.searchMessages")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      )}
      {convInfo && (convInfo.type === "group" || convInfo.type === "channel") && (
        <div className="px-4 py-2.5 bg-primary text-primary-foreground flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupManagementOpen(true)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-start"
          >
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{convInfo.name || t("chat.group")}</p>
              <p className="text-xs text-primary-foreground/70">{convInfo.memberCount} {t("chat.members")}</p>
            </div>
          </button>
          {isAdmin && convInfo.type === "channel" && (
            <Button variant="ghost" size="icon" onClick={() => { setAnnouncementDraft(convInfo.announcement || ""); setEditingAnnouncement(true); }} title="Set announcement" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
              <Megaphone className="w-4 h-4" />
            </Button>
          )}
          {onStartCall && (
            <>
              <Button variant="ghost" size="icon" onClick={() => onStartCall(conversationId!, "voice")} title="Voice call" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onStartCall(conversationId!, "video")} title="Video call" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                <Video className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? t("chat.enableNotif") : t("chat.disableNotif")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" title="Disappearing messages" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
                {convInfo.disappearAfter ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4 opacity-70" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5" align="end" side="bottom">
              <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Disappearing messages</p>
              {DISAPPEAR_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setDisappearAfter(opt.value)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                    convInfo.disappearAfter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggleSearch} title={t("chat.searchMessages")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Pinned messages banner */}
      {pinnedMessageIds.size > 0 && showPinnedBanner && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
          <button
            type="button"
            className="text-xs text-primary font-medium hover:underline"
            onClick={() => {
              const firstPinned = messages.find((m) => pinnedMessageIds.has(m.id));
              if (firstPinned) {
                document.getElementById(`msg-${firstPinned.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          >
            {pinnedMessageIds.size} {t("chat.pinnedMessages")}
          </button>
          <button
            onClick={() => setShowPinnedBanner(false)}
            className="ms-auto p-0.5 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Disappearing messages banner */}
      {convInfo?.disappearAfter && (
        <div className="px-4 py-1.5 border-b border-border bg-primary/5 flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium">
            Disappearing messages: {DISAPPEAR_OPTIONS.find((o) => o.value === convInfo.disappearAfter)?.label || "On"}
          </span>
        </div>
      )}

      {/* Announcement banner */}
      {convInfo?.type === "channel" && (convInfo.announcement || editingAnnouncement) && !announcementDismissed && (
        <div id="announcement-banner" className="px-4 py-2.5 border-b border-border bg-accent/30 animate-fade-in">
          {editingAnnouncement ? (
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary shrink-0" />
              <textarea
                className="flex-1 bg-transparent text-sm border border-border rounded-md px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={2}
                value={announcementDraft}
                onChange={(e) => setAnnouncementDraft(e.target.value)}
                placeholder="Type announcement..."
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                await supabase.from("conversations").update({ announcement: announcementDraft.trim() || null } as any).eq("id", conversationId);
                setEditingAnnouncement(false);
              }}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingAnnouncement(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm flex-1">{convInfo.announcement}</span>
              {isAdmin && (
                <>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setAnnouncementDraft(convInfo.announcement || ""); setEditingAnnouncement(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => {
                    await supabase.from("conversations").update({ announcement: null } as any).eq("id", conversationId);
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAnnouncementDismissed(true)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder={t("chat.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
          {searchResults.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {searchIndex + 1}/{searchResults.length}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setSearchIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1))}
            disabled={searchResults.length === 0}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setSearchIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0))}
            disabled={searchResults.length === 0}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleSearch}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden tg-chat-bg">
        {/* Wallpaper background layer */}
        {wallpaperId !== "none" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={(() => {
              const base: React.CSSProperties = { opacity: wallpaperOpacity };
              if (isCustomWallpaper(wallpaperId)) {
                return {
                  ...base,
                  backgroundImage: `url(${getCustomWallpaperUrl(wallpaperId)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                };
              }
              const wp = WALLPAPERS.find((w) => w.id === wallpaperId);
              if (!wp || !wp.gradient) return base;
              const s: React.CSSProperties = { ...base, backgroundImage: wp.gradient };
              if (wp.size) s.backgroundSize = wp.size;
              return s;
            })()}
          />
        )}
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">{t("chat.loadingMessages")}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {t("chat.startConversation")}
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
            const isMedia = msg.type === "image" || msg.type === "file";
            const isSearchMatch = searchResults.includes(msg.id);
            const isCurrentMatch = searchResults[searchIndex] === msg.id;

            // Compute who has seen this message (for own messages only)
            const seenByUsers = isMe
              ? readReceipts.filter((r) => r.last_read_at >= msg.created_at)
              : [];
            const nextMsg = messages[i + 1];
            // Show seen indicator on the last consecutive own message that someone has read
            const isLastSeen = seenByUsers.length > 0 && (!nextMsg || nextMsg.sender_id !== user?.id || !readReceipts.some((r) => r.last_read_at >= nextMsg.created_at));

            return (
              <SwipeToReply
                key={msg.id}
                isMe={isMe}
                disabled={msg.is_deleted}
                onSwipeReply={() => { setReplyTo(msg); inputRef.current?.focus(); }}
              >
              <MessageContextMenu
                messageId={msg.id}
                isMe={isMe}
                disabled={msg.is_deleted}
                isPinned={pinnedMessageIds.has(msg.id)}
                onReply={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                onForward={() => setForwardMsg(msg)}
                onPin={() => pinnedMessageIds.has(msg.id) ? unpinMessage(msg.id) : pinMessage(msg.id)}
                onDelete={isMe ? () => deleteMessage(msg) : undefined}
                onEdit={isMe && msg.type === "text" ? () => { setEditingMsg(msg); setEditText(msg.content || ""); } : undefined}
                onCopy={msg.type === "text" && msg.content ? () => { navigator.clipboard.writeText(msg.content || ""); } : undefined}
              >
              <div id={`msg-${msg.id}`} className={cn(
                "flex gap-2 group/msg transition-all duration-200",
                isMe ? "flex-row-reverse msg-animate-in-right" : "flex-row msg-animate-in-left",
                isCurrentMatch && "bg-primary/20 rounded-xl",
                isSearchMatch && !isCurrentMatch && "bg-primary/5 rounded-xl",
              )}>
                {!isMe && (
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      <UserProfilePopup
                        userId={msg.sender_id}
                        displayName={msg.sender?.display_name}
                        avatarUrl={msg.sender?.avatar_url}
                        isOnline={isOnline(msg.sender_id)}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={msg.sender?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {msg.sender?.display_name?.slice(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                      </UserProfilePopup>
                    )}
                  </div>
                )}
                <div className={cn("max-w-[85%] sm:max-w-[70%] space-y-1", isMe && "items-end")}>
                  {showAvatar && !isMe && (
                    <p className="text-xs text-muted-foreground font-medium pl-1">
                      {msg.sender?.display_name || t("chat.user")}
                    </p>
                  )}
                  {/* Replied-to preview */}
                  {msg.reply_to && (() => {
                    const repliedMsg = messages.find((m) => m.id === msg.reply_to);
                    if (!repliedMsg) return null;
                    return (
                      <div className={cn(
                        "text-[11px] px-3 py-1.5 rounded-xl border-l-2 border-primary/40 bg-muted/60 max-w-full truncate",
                        isMe && "text-right"
                      )}>
                        <span className="font-semibold text-primary/70">
                          {repliedMsg.sender?.display_name || t("chat.user")}
                        </span>
                        <p className="truncate text-muted-foreground">
                          {repliedMsg.is_deleted ? t("chat.deletedMessage") :
                            repliedMsg.type === "image" ? "📷" :
                            repliedMsg.type === "file" ? "📎" :
                            repliedMsg.content || ""}
                        </p>
                      </div>
                    );
                  })()}
                  <div
                    className={cn(
                      "rounded-2xl leading-relaxed shadow-sm transition-shadow hover:shadow-md",
                      isMedia ? "p-1" : "px-3.5 py-2",
                      isMe
                        ? "bg-tg-msg-out rounded-br-sm"
                        : "bg-tg-msg-in rounded-bl-sm",
                      msg.type === "text" && msg.content?.includes("❤️") && "heartbeat-pulse"
                    )}
                    style={{ fontSize: "var(--chat-font-size, 14px)" }}
                  >
                    {editingMsg?.id === msg.id ? (
                      <div className="flex items-center gap-1.5 min-w-[160px]">
                        <input
                          autoFocus
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditMessage();
                            if (e.key === "Escape") { setEditingMsg(null); setEditText(""); }
                          }}
                          className="bg-transparent border-b border-primary-foreground/40 outline-none text-sm flex-1 min-w-0 placeholder:text-primary-foreground/50"
                          placeholder={t("chat.editPlaceholder")}
                        />
                        <button onClick={saveEditMessage} className="p-0.5 hover:opacity-80" title={t("chat.save")}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setEditingMsg(null); setEditText(""); }} className="p-0.5 hover:opacity-80" title={t("chat.cancel")}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      renderMessageContent(msg, isMe)
                    )}
                  </div>
                  {!msg.is_deleted && (
                    <MessageReactions messageId={msg.id} isMe={isMe} />
                  )}
                  <div className={cn("flex items-center gap-1 px-1", isMe && "justify-end")}>
                    {pinnedMessageIds.has(msg.id) && (
                      <Pin className="w-2.5 h-2.5 text-primary" />
                    )}
                    {msg.sender?.language && LANGUAGE_FLAGS[msg.sender.language] && (
                      <span className="text-[10px]" title={msg.sender.language}>
                        {LANGUAGE_FLAGS[msg.sender.language]}
                      </span>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                    {(msg as any).expires_at && (
                      <span title={`Disappears ${format(new Date((msg as any).expires_at), "MMM d, HH:mm")}`}>
                        <Timer className="w-2.5 h-2.5 text-primary/60" />
                      </span>
                    )}
                    {msg.updated_at && msg.updated_at !== msg.created_at && !msg.is_deleted && (
                      <span className="text-[10px] text-muted-foreground italic">{t("chat.edited")}</span>
                    )}
                    {/* Message status checkmarks for own messages */}
                    {isMe && !msg.is_deleted && (
                      seenByUsers.length > 0 ? (
                        <CheckCheck className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      )
                    )}
                    {isLastSeen && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 cursor-pointer">
                            {convInfo?.type === "group" && seenByUsers.length > 0 ? (
                              <span className="flex -space-x-1.5">
                                {seenByUsers.slice(0, 4).map((r) => (
                                  <Avatar key={r.user_id} className="w-4 h-4 border border-background">
                                    <AvatarImage src={r.avatar_url || undefined} />
                                    <AvatarFallback className="text-[6px] bg-primary/10 text-primary">
                                      {r.display_name.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {seenByUsers.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground ml-1">+{seenByUsers.length - 4}</span>
                                )}
                              </span>
                            ) : null}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto max-w-[180px] p-2" side="top" align="end">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Seen by</p>
                          <div className="space-y-1.5">
                            {seenByUsers.map((r) => (
                              <div key={r.user_id} className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={r.avatar_url || undefined} />
                                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                    {r.display_name.slice(0, 1).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-foreground">{r.display_name}</span>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </div>
              </MessageContextMenu>
              </SwipeToReply>
            );
          })
        )}
      </div>
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="px-3 pt-2 flex gap-2 flex-wrap border-t border-border bg-card">
          {pendingFiles.map((file, i) => (
            <div
              key={i}
              className="relative group flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs max-w-[200px]"
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-10 h-10 rounded object-cover"
                />
              ) : (
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => removePendingFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Typing indicator */}
      <TypingIndicator names={typingNames} />

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 py-2 border-t border-border bg-card flex items-center gap-2">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
            <p className="text-xs font-semibold text-primary truncate">
              {replyTo.sender?.display_name || t("chat.user")}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.type === "image" ? "📷" : replyTo.type === "file" ? "📎" : replyTo.content || ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="p-2 sm:p-3 border-t border-border bg-card safe-area-bottom">
        {isRecording ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
              className="shrink-0 text-destructive hover:text-destructive"
              title={t("chat.cancel")}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">
                {t("chat.recording")} {formatDuration(recordingDuration)}
              </span>
            </div>
            <Button
              type="button"
              size="icon"
              onClick={stopRecording}
              className="shrink-0"
              title={t("chat.send")}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <EmojiPicker onSelect={handleEmojiSelect} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => imageInputRef.current?.click()}
              title={t("chat.sendImage")}
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              title={t("chat.attachFile")}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            {/* GIF button */}
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-primary"
                onClick={() => setGifPickerOpen(!gifPickerOpen)}
                title="GIF"
              >
                <span className="text-xs font-bold">GIF</span>
              </Button>
              {gifPickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-50">
                  <GifPicker
                    onSelect={async (gifUrl) => {
                      setGifPickerOpen(false);
                      if (!conversationId || !user) return;
                      const { error } = await supabase.from("messages").insert({
                        conversation_id: conversationId,
                        sender_id: user.id,
                        content: gifUrl,
                        type: "image",
                      });
                      if (error) toast.error("Failed to send GIF");
                    }}
                    onClose={() => setGifPickerOpen(false)}
                  />
                </div>
              )}
            </div>
            <Input
              ref={inputRef}
              placeholder={t("chat.inputPlaceholder")}
              value={newMessage}
              onChange={handleInputChange}
              className="bg-muted/50 border-0"
            />
            {newMessage.trim() || pendingFiles.length > 0 ? (
              <>
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      title={t("chat.scheduleSend")}
                      disabled={!newMessage.trim()}
                    >
                      <Clock className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 pointer-events-auto" align="end" side="top">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">{t("chat.scheduleTitle")}</p>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">{t("chat.date")}</label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">{t("chat.time")}</label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={scheduleMessage}
                        disabled={!scheduleDate || !scheduleTime}
                      >
                        <Clock className="w-4 h-4 mr-1" /> {t("chat.schedule")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || uploading}
                  className="shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={startRecording}
                className="shrink-0 text-muted-foreground hover:text-primary"
                title={t("chat.voiceRecord")}
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </form>

      {/* Group Management Dialog */}
      {conversationId && (
        <GroupManagementDialog
          open={groupManagementOpen}
          onOpenChange={setGroupManagementOpen}
          conversationId={conversationId}
          onUpdated={loadConvInfo}
        />
      )}

      {/* Lightbox with navigation */}
      {lightboxUrl && (() => {
        const allImages = messages.filter((m) => m.type === "image" && m.content).map((m) => m.content!);
        const currentIdx = allImages.indexOf(lightboxUrl);
        return (
          <MediaLightbox
            images={allImages}
            currentIndex={currentIdx >= 0 ? currentIdx : 0}
            onClose={() => setLightboxUrl(null)}
          />
        );
      })()}

      {/* Forward dialog */}
      <ForwardMessageDialog
        open={!!forwardMsg}
        onOpenChange={(open) => { if (!open) setForwardMsg(null); }}
        message={forwardMsg}
        currentConversationId={conversationId}
      />
    </div>
    </>
  );
}
