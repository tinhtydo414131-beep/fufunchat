import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, Search, Plus, LogOut, User, SearchCheck, Settings, Phone, Menu, Users, Pin, PinOff, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "./SettingsDialog";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useI18n";
import { format, isToday, isYesterday } from "date-fns";
import funLogo from "@/assets/fun-logo.png";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  other_user?: { display_name: string; avatar_url: string | null; user_id?: string };
  other_user_id?: string;
  last_message?: string;
  last_message_time?: string;
  last_message_sender_is_me?: boolean;
  last_message_is_read?: boolean;
  unread_count?: number;
  pinned_at?: string | null;
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  refreshKey?: number;
  isOnline: (userId: string) => boolean;
  onGlobalSearch?: () => void;
  onCallHistory?: () => void;
}

function getLastReadKey(userId: string, convId: string) {
  return `lastRead:${userId}:${convId}`;
}

export function markConversationRead(userId: string, convId: string) {
  localStorage.setItem(getLastReadKey(userId, convId), new Date().toISOString());
}

function formatConvTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yy");
}

function ConversationItem({ conv, name, avatarUrl, colorClass, isPinned, isSelected, isOnline, onSelect, onTogglePin, t }: {
  conv: Conversation;
  name: string;
  avatarUrl: string | null | undefined;
  colorClass: string;
  isPinned: boolean;
  isSelected: boolean;
  isOnline: (userId: string) => boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  t: (key: string) => string;
}) {
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

  return (
    <div className="relative">
      <button
        onClick={onSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxPos({ x: e.clientX, y: e.clientY });
          setCtxOpen(true);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 transition-all text-start",
          "hover:bg-muted/50 active:bg-muted/70",
          isSelected && "bg-primary/10",
          "animate-in fade-in-50 duration-200"
        )}
      >
        <div className="relative">
          <Avatar className="w-[50px] h-[50px] shrink-0">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className={cn("text-sm font-semibold", colorClass)}>
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {conv.type === "direct" && conv.other_user_id && isOnline(conv.other_user_id) && (
            <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              {isPinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
              <p className="text-sm font-semibold truncate">{name}</p>
            </div>
            <span className={cn(
              "text-[11px] shrink-0",
              (conv.unread_count ?? 0) > 0 ? "text-primary font-semibold" : "text-muted-foreground"
            )}>
              {conv.last_message_time ? formatConvTime(conv.last_message_time) : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {conv.last_message_sender_is_me && (
                conv.last_message_is_read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )
              )}
              <span className="truncate">
                {conv.last_message || (
                  conv.type === "direct" && conv.other_user_id
                    ? isOnline(conv.other_user_id) ? t("sidebar.active") : t("sidebar.offline")
                    : conv.type === "group" ? `👥 ${t("sidebar.group")}` : t("sidebar.chat")
                )}
              </span>
            </p>
            {(conv.unread_count ?? 0) > 0 && (
              <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-primary text-primary-foreground border-0 shrink-0 rounded-full">
                {conv.unread_count! > 99 ? "99+" : conv.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </button>

      {/* Right-click context menu for pin/unpin */}
      {ctxOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setCtxOpen(false)} />
          <div
            className="fixed z-[100] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in zoom-in-90 fade-in-0 duration-150"
            style={{
              left: Math.min(ctxPos.x, window.innerWidth - 180),
              top: Math.min(ctxPos.y, window.innerHeight - 100),
            }}
          >
            <button
              onClick={() => { setCtxOpen(false); onTogglePin(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-popover-foreground hover:bg-accent transition-colors"
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {isPinned ? "Unpin" : "Pin to top"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ConversationList({ selectedId, onSelect, onNewChat, onSignOut, refreshKey, isOnline, onGlobalSearch, onCallHistory }: ConversationListProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user, refreshKey]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("conversation_id, pinned_at")
      .eq("user_id", user.id);

    if (!memberData || memberData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = memberData.map((m) => m.conversation_id);
    const pinnedMap = new Map(memberData.map((m) => [m.conversation_id, m.pinned_at]));

    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convData) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      convData.map(async (conv) => {
        if (conv.type === "direct") {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv.id)
            .neq("user_id", user.id)
            .limit(1);

          if (members && members.length > 0) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("user_id", members[0].user_id)
              .single();
            return { ...conv, other_user: profile || undefined, other_user_id: members[0].user_id, pinned_at: pinnedMap.get(conv.id) || null };
          }
        }
        return { ...conv, pinned_at: pinnedMap.get(conv.id) || null };
      })
    );

    const enrichedWithExtra = await Promise.all(
      (enriched as Conversation[]).map(async (conv) => {
        const { data: lastMsgData } = await supabase
          .from("messages")
          .select("content, type, is_deleted, sender_id, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let last_message = "";
        let last_message_time = conv.updated_at;
        let last_message_sender_is_me = false;
        let last_message_is_read = false;

        if (lastMsgData && lastMsgData.length > 0) {
          const lm = lastMsgData[0];
          last_message_time = lm.created_at;
          last_message_sender_is_me = lm.sender_id === user.id;
          if (lm.is_deleted) {
            last_message = t("chat.deletedPreview");
          } else if (lm.type === "image") {
            last_message = t("chat.imagePreview");
          } else if (lm.type === "file") {
            last_message = t("chat.filePreview");
          } else if (lm.type === "voice") {
            last_message = t("chat.voicePreview");
          } else {
            last_message = lm.content || "";
          }

          // Check if other users have read the last message
          if (last_message_sender_is_me) {
            const { data: readData } = await supabase
              .from("message_reads")
              .select("last_read_at")
              .eq("conversation_id", conv.id)
              .neq("user_id", user.id)
              .gte("last_read_at", lm.created_at)
              .limit(1);
            last_message_is_read = !!(readData && readData.length > 0);
          }
        }

        const lastRead = localStorage.getItem(getLastReadKey(user.id, conv.id));
        let query = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id);
        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }
        const { count } = await query;
        return { ...conv, unread_count: count || 0, last_message, last_message_time, last_message_sender_is_me, last_message_is_read };
      })
    );

    // Sort: pinned first, then by updated_at
    enrichedWithExtra.sort((a, b) => {
      const aPinned = a.pinned_at ? 1 : 0;
      const bPinned = b.pinned_at ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    setConversations(enrichedWithExtra);
    setLoading(false);
  };

  const handleSelect = (id: string) => {
    if (user) markConversationRead(user.id, id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unread_count: 0 } : c));
    onSelect(id);
  };

  const togglePinConversation = async (convId: string, currentlyPinned: boolean) => {
    if (!user) return;
    const newVal = currentlyPinned ? null : new Date().toISOString();
    const { error } = await supabase
      .from("conversation_members")
      .update({ pinned_at: newVal })
      .eq("conversation_id", convId)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Failed to update pin");
      return;
    }
    toast.success(currentlyPinned ? "Conversation unpinned" : "Conversation pinned");
    setConversations((prev) => {
      const updated = prev.map((c) => c.id === convId ? { ...c, pinned_at: newVal } : c);
      updated.sort((a, b) => {
        const aPinned = a.pinned_at ? 1 : 0;
        const bPinned = b.pinned_at ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      return updated;
    });
  };

  const filtered = conversations.filter((c) => {
    const name = c.type === "direct" ? c.other_user?.display_name : c.name;
    return !search || (name && name.toLowerCase().includes(search.toLowerCase()));
  });

  const getDisplayName = (c: Conversation) => {
    if (c.type === "direct" && c.other_user) return c.other_user.display_name;
    return c.name || t("chat.group");
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const funColors = [
    "bg-fun-pink text-foreground",
    "bg-fun-lavender text-foreground",
    "bg-fun-mint text-foreground",
    "bg-fun-gold text-foreground",
    "bg-fun-cyan text-foreground",
  ];

  return (
    <div className="flex flex-col h-full bg-card border-e border-border">
      {/* Telegram-style Header with Hamburger */}
      <div className="px-3 py-2.5 bg-primary text-primary-foreground flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full shrink-0">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover border-border shadow-xl z-50">
            <DropdownMenuItem onClick={onNewChat} className="gap-3 py-2.5 cursor-pointer">
              <Plus className="w-4 h-4" /> New Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewChat} className="gap-3 py-2.5 cursor-pointer">
              <Users className="w-4 h-4" /> New Group
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-3 py-2.5 cursor-pointer">
              <User className="w-4 h-4" /> Profile
            </DropdownMenuItem>
            {onCallHistory && (
              <DropdownMenuItem onClick={onCallHistory} className="gap-3 py-2.5 cursor-pointer">
                <Phone className="w-4 h-4" /> Call History
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="gap-3 py-2.5 cursor-pointer">
              <Settings className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="gap-3 py-2.5 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <h2 className="text-base font-semibold tracking-tight flex-1">FUN Chat</h2>

        {onGlobalSearch && (
          <Button variant="ghost" size="icon" onClick={onGlobalSearch} title={t("sidebar.globalSearch")} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <Search className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("sidebar.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 bg-muted/50 rounded-lg border-border/40 h-9 text-sm"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t("sidebar.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <div className="text-3xl">💬</div>
            <p className="text-sm text-muted-foreground">
              {search ? t("sidebar.noResults") : t("sidebar.startFirst")}
            </p>
            {!search && (
              <Button size="sm" onClick={onNewChat} className="rounded-lg">
                <Plus className="w-4 h-4 me-1" /> {t("sidebar.newChatBtn")}
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((conv, idx) => {
              const name = getDisplayName(conv);
              const avatarUrl = conv.type === "direct" ? conv.other_user?.avatar_url : conv.avatar_url;
              const colorClass = funColors[idx % funColors.length];
              const isPinned = !!conv.pinned_at;
              return (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  name={name}
                  avatarUrl={avatarUrl}
                  colorClass={colorClass}
                  isPinned={isPinned}
                  isSelected={selectedId === conv.id}
                  isOnline={isOnline}
                  onSelect={() => handleSelect(conv.id)}
                  onTogglePin={() => togglePinConversation(conv.id, isPinned)}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </ScrollArea>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
