import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Paperclip, Image as ImageIcon, X, FileText, Download, Users, Settings, Reply, Trash2, Undo2, Search, ChevronUp, ChevronDown, Mic, Square, Play, Pause, Forward, Pin, PinOff, Pencil, Check, BellOff, Bell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { EmojiPicker } from "./EmojiPicker";
import { TypingIndicator } from "./TypingIndicator";
import { GroupManagementDialog } from "./GroupManagementDialog";
import { MessageReactions } from "./MessageReactions";
import { UserProfilePopup } from "./UserProfilePopup";
import { ForwardMessageDialog } from "./ForwardMessageDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { playNotificationSound } from "@/lib/notificationSound";
import { markConversationRead } from "./ConversationList";
import { useUserStatus, STATUS_EMOJI, STATUS_LABELS } from "@/hooks/useUserStatus";

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
  sender?: { display_name: string; avatar_url: string | null };
}

interface ChatAreaProps {
  conversationId: string | null;
  isOnline: (userId: string) => boolean;
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

export function ChatArea({ conversationId, isOnline }: ChatAreaProps) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const { getUserStatus, statusMap } = useUserStatus();
  const [otherUserStatus, setOtherUserStatus] = useState<{ status: string; custom_text: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [convInfo, setConvInfo] = useState<{ type: string; name: string | null; memberCount: number; otherUserId?: string; otherUserName?: string } | null>(null);
  const [groupManagementOpen, setGroupManagementOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Use the latest read timestamp among other users
      const latest = data.reduce((a, b) => a.last_read_at > b.last_read_at ? a : b);
      setOtherReadAt(latest.last_read_at);
    } else {
      setOtherReadAt(null);
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
      toast.error("Không thể ghim tin nhắn");
    } else {
      toast.success("Đã ghim tin nhắn 📌");
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
      toast.error("Không thể bỏ ghim tin nhắn");
    } else {
      toast.success("Đã bỏ ghim tin nhắn");
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
    toast.success(newVal ? "Đã tắt thông báo 🔕" : "Đã bật thông báo 🔔");
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
            .select("display_name, avatar_url")
            .eq("user_id", newMsg.sender_id)
            .single();

          // Send browser notification for messages from others
          if (newMsg.sender_id !== user?.id && !isMutedRef.current) {
            playNotificationSound();
            const senderName = profile?.display_name || "Ai đó";
            const body = newMsg.type === "text" ? (newMsg.content || "") : newMsg.type === "image" ? "Đã gửi ảnh 📷" : "Đã gửi tệp 📎";
            sendNotification(`${senderName}`, { body, tag: `msg-${newMsg.id}` });
            // Update own read receipt since we're viewing this conversation
            updateReadReceipt();
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: profile || undefined }];
          });
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

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(readChannel);
      supabase.removeChannel(pinChannel);
    };
  }, [conversationId, user?.id]);

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
        .select("user_id, display_name, avatar_url")
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
      .select("type, name")
      .eq("id", conversationId)
      .maybeSingle();

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
      setConvInfo({ type: conv.type, name: conv.name, memberCount: count || 0, otherUserId, otherUserName });
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
            toast.error(`Không thể tải lên ${file.name} 😢`);
            continue;
          }

          const isImage = file.type.startsWith("image/");
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: url,
            type: isImage ? "image" : "file",
            reply_to: replyTo?.id || null,
          });
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
        });
        if (error) setNewMessage(content);
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
      toast.error("Vui lòng nhập tin nhắn và chọn thời gian hẹn giờ");
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast.error("Thời gian hẹn giờ phải trong tương lai");
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
      toast.error("Không thể hẹn giờ tin nhắn");
    } else {
      toast.success(`Tin nhắn sẽ được gửi lúc ${format(scheduledAt, "HH:mm dd/MM/yyyy")} ⏰`);
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
        displayName: user.user_metadata?.display_name || user.email?.split("@")[0] || "Ai đó",
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
    const maxSize = 20 * 1024 * 1024; // 20MB
    const valid = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name} quá lớn (tối đa 20MB)`);
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
          toast.error("Tin nhắn thoại quá ngắn");
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
      toast.error("Không thể truy cập micro 🎤");
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
        toast.error("Không thể tải lên tin nhắn thoại 😢");
        return;
      }

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: urlData.publicUrl,
        type: "voice",
        reply_to: replyTo?.id || null,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      setReplyTo(null);
      toast.success("Đã gửi tin nhắn thoại 🎤");
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
      toast.error("Không thể thu hồi tin nhắn");
    } else {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, is_deleted: true, content: null } : m));
      toast.success("Đã thu hồi tin nhắn");
    }
  };

  const saveEditMessage = async () => {
    if (!editingMsg || !editText.trim()) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: editText.trim(), updated_at: new Date().toISOString() })
      .eq("id", editingMsg.id);
    if (error) {
      toast.error("Không thể chỉnh sửa tin nhắn");
    } else {
      setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, content: editText.trim(), updated_at: new Date().toISOString() } : m));
      toast.success("Đã chỉnh sửa tin nhắn ✏️");
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
      toast.error("Không thể xóa tin nhắn");
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success("Đã xóa tin nhắn");
    }
  };

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    if (msg.is_deleted) {
      return <span className="italic text-muted-foreground">Tin nhắn đã được thu hồi</span>;
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
            alt="Ảnh"
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
          <Download className="w-4 h-4 shrink-0 ml-auto" />
        </a>
      );
    }

    if (msg.type === "voice" && msg.content) {
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <Mic className="w-4 h-4 shrink-0 text-primary" />
          <audio controls preload="metadata" className="h-8 max-w-[220px]">
            <source src={msg.content} type="audio/webm" />
          </audio>
        </div>
      );
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
          <h2 className="text-xl font-bold">Chào mừng đến FUN Chat ✨</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Chọn một cuộc trò chuyện hoặc bắt đầu cuộc trò chuyện mới để kết nối với ánh sáng 💛
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col bg-background relative"
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
            toast.error(`${f.name} quá lớn (tối đa 20MB)`);
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
            <p className="text-sm font-medium text-primary">Thả tệp vào đây để gửi</p>
          </div>
        </div>
      )}
      {/* Chat Header */}
      {convInfo && convInfo.type === "direct" && convInfo.otherUserId && (
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {convInfo.otherUserName?.slice(0, 2).toUpperCase() || "??"}
            </div>
            {isOnline(convInfo.otherUserId) && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{convInfo.otherUserName || "Người dùng"}</p>
            <p className={cn("text-xs", isOnline(convInfo.otherUserId) ? "text-green-500" : "text-muted-foreground")}>
              {otherUserStatus
                ? `${STATUS_EMOJI[otherUserStatus.status as keyof typeof STATUS_EMOJI] || "⚫"} ${STATUS_LABELS[otherUserStatus.status as keyof typeof STATUS_LABELS] || otherUserStatus.status}${otherUserStatus.custom_text ? ` · ${otherUserStatus.custom_text}` : ""}`
                : isOnline(convInfo.otherUserId) ? "Đang hoạt động" : "Ngoại tuyến"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? "Bật thông báo" : "Tắt thông báo"}>
            {isMuted ? <BellOff className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleSearch} title="Tìm kiếm tin nhắn">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      )}
      {convInfo && convInfo.type === "group" && (
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupManagementOpen(true)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{convInfo.name || "Nhóm"}</p>
              <p className="text-xs text-muted-foreground">{convInfo.memberCount} thành viên</p>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? "Bật thông báo" : "Tắt thông báo"}>
            {isMuted ? <BellOff className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleSearch} title="Tìm kiếm tin nhắn">
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
            {pinnedMessageIds.size} tin nhắn đã ghim 📌
          </button>
          <button
            onClick={() => setShowPinnedBanner(false)}
            className="ml-auto p-0.5 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            placeholder="Tìm kiếm tin nhắn..."
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Đang tải tin nhắn... ✨</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Bắt đầu cuộc trò chuyện nào! Gửi tin nhắn đầu tiên 💛
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
            const isMedia = msg.type === "image" || msg.type === "file";
            const isSearchMatch = searchResults.includes(msg.id);
            const isCurrentMatch = searchResults[searchIndex] === msg.id;

            // Show "Seen" on the last of my messages that the other user has read
            const isSeen = isMe && otherReadAt && msg.created_at <= otherReadAt;
            const nextMsg = messages[i + 1];
            const isLastSeen = isSeen && (!nextMsg || nextMsg.sender_id !== user?.id || (otherReadAt && nextMsg.created_at > otherReadAt));

            return (
              <div id={`msg-${msg.id}`} key={msg.id} className={cn(
                "flex gap-2 group/msg transition-colors duration-300",
                isMe ? "flex-row-reverse" : "flex-row",
                isCurrentMatch && "bg-primary/20 rounded-xl",
                isSearchMatch && !isCurrentMatch && "bg-primary/5 rounded-xl"
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
                <div className={cn("max-w-[70%] space-y-1", isMe && "items-end")}>
                  {showAvatar && !isMe && (
                    <p className="text-xs text-muted-foreground font-medium pl-1">
                      {msg.sender?.display_name || "Người dùng"}
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
                          {repliedMsg.sender?.display_name || "Người dùng"}
                        </span>
                        <p className="truncate text-muted-foreground">
                          {repliedMsg.is_deleted ? "Tin nhắn đã thu hồi" :
                            repliedMsg.type === "image" ? "📷 Ảnh" :
                            repliedMsg.type === "file" ? "📎 File" :
                            repliedMsg.content || ""}
                        </p>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-0.5">
                    {isMe && !msg.is_deleted && (
                      <>
                        <button
                          onClick={() => deleteMessage(msg)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Xóa tin nhắn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => recallMessage(msg)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Thu hồi tin nhắn"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Trả lời"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        {msg.type === "text" && (
                          <button
                            onClick={() => { setEditingMsg(msg); setEditText(msg.content || ""); }}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                            title="Chỉnh sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setForwardMsg(msg)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Chuyển tiếp"
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => pinnedMessageIds.has(msg.id) ? unpinMessage(msg.id) : pinMessage(msg.id)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title={pinnedMessageIds.has(msg.id) ? "Bỏ ghim" : "Ghim tin nhắn"}
                        >
                          {pinnedMessageIds.has(msg.id) ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl leading-relaxed",
                        isMedia ? "p-1" : "px-4 py-2",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
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
                            placeholder="Chỉnh sửa..."
                          />
                          <button onClick={saveEditMessage} className="p-0.5 hover:opacity-80" title="Lưu">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setEditingMsg(null); setEditText(""); }} className="p-0.5 hover:opacity-80" title="Hủy">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        renderMessageContent(msg, isMe)
                      )}
                    </div>
                    {!isMe && !msg.is_deleted && (
                      <>
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Trả lời"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setForwardMsg(msg)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Chuyển tiếp"
                        >
                          <Forward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => pinnedMessageIds.has(msg.id) ? unpinMessage(msg.id) : pinMessage(msg.id)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
                          title={pinnedMessageIds.has(msg.id) ? "Bỏ ghim" : "Ghim tin nhắn"}
                        >
                          {pinnedMessageIds.has(msg.id) ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                  </div>
                  {!msg.is_deleted && (
                    <MessageReactions messageId={msg.id} isMe={isMe} />
                  )}
                  <div className={cn("flex items-center gap-1 px-1", isMe && "justify-end")}>
                    {pinnedMessageIds.has(msg.id) && (
                      <Pin className="w-2.5 h-2.5 text-primary" />
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                    {msg.updated_at && msg.updated_at !== msg.created_at && !msg.is_deleted && (
                      <span className="text-[10px] text-muted-foreground italic">(đã chỉnh sửa)</span>
                    )}
                    {isLastSeen && (
                      <span className="text-[10px] text-primary font-medium">✓ Đã xem</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
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
              {replyTo.sender?.display_name || "Người dùng"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.type === "image" ? "📷 Ảnh" : replyTo.type === "file" ? "📎 File" : replyTo.content || ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-border bg-card">
        {isRecording ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
              className="shrink-0 text-destructive hover:text-destructive"
              title="Hủy"
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">
                Đang ghi âm... {formatDuration(recordingDuration)}
              </span>
            </div>
            <Button
              type="button"
              size="icon"
              onClick={stopRecording}
              className="shrink-0"
              title="Gửi"
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
              title="Gửi ảnh"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm file"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input
              ref={inputRef}
              placeholder="Nhập tin nhắn... ✨"
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
                      title="Hẹn giờ gửi"
                      disabled={!newMessage.trim()}
                    >
                      <Clock className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 pointer-events-auto" align="end" side="top">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Hẹn giờ gửi ⏰</p>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Ngày</label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Giờ</label>
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
                        <Clock className="w-4 h-4 mr-1" /> Hẹn giờ
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
                title="Ghi âm tin nhắn thoại"
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

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/20 hover:bg-background/40 flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-primary-foreground" />
          </button>
          <img
            src={lightboxUrl}
            alt="Ảnh phóng to"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Forward dialog */}
      <ForwardMessageDialog
        open={!!forwardMsg}
        onOpenChange={(open) => { if (!open) setForwardMsg(null); }}
        message={forwardMsg}
        currentConversationId={conversationId}
      />
    </div>
  );
}
