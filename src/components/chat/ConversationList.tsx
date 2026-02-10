import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Search, Plus, LogOut, User, SearchCheck, Settings, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "./SettingsDialog";
import { useTranslation } from "@/hooks/useI18n";
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
  unread_count?: number;
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
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberData || memberData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = memberData.map((m) => m.conversation_id);

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
            return { ...conv, other_user: profile || undefined, other_user_id: members[0].user_id };
          }
        }
        return conv;
      })
    );

    const enrichedWithExtra = await Promise.all(
      (enriched as Conversation[]).map(async (conv) => {
        const { data: lastMsgData } = await supabase
          .from("messages")
          .select("content, type, is_deleted, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);

        let last_message = "";
        if (lastMsgData && lastMsgData.length > 0) {
          const lm = lastMsgData[0];
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
          if (lm.sender_id === user.id && !lm.is_deleted) {
            last_message = `${t("chat.youPrefix")}: ${last_message}`;
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
        return { ...conv, unread_count: count || 0, last_message };
      })
    );

    setConversations(enrichedWithExtra);
    setLoading(false);
  };

  const handleSelect = (id: string) => {
    if (user) markConversationRead(user.id, id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unread_count: 0 } : c));
    onSelect(id);
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

  // Assign a fun color to each conversation for avatar fallback
  const funColors = [
    "bg-fun-pink text-foreground",
    "bg-fun-lavender text-foreground",
    "bg-fun-mint text-foreground",
    "bg-fun-gold text-foreground",
    "bg-fun-cyan text-foreground",
  ];

  return (
    <div className="flex flex-col h-full bg-card border-e border-border">
      {/* Telegram-style Header */}
      <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="w-5 h-5" />
          <h2 className="text-base font-semibold tracking-tight">FUN Chat</h2>
        </div>
        <div className="flex gap-0.5">
          {onGlobalSearch && (
            <Button variant="ghost" size="icon" onClick={onGlobalSearch} title={t("sidebar.globalSearch")} className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
              <SearchCheck className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onNewChat} title={t("sidebar.newChat")} className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <Plus className="w-5 h-5" />
          </Button>
          {onCallHistory && (
            <Button variant="ghost" size="icon" onClick={onCallHistory} title="Call History" className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
              <Phone className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title={t("sidebar.settings")} className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} title={t("sidebar.profile")} className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <User className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSignOut} title={t("sidebar.signOut")} className="hidden sm:inline-flex text-primary-foreground hover:bg-primary-foreground/10 rounded-full">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
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
              <Button
                size="sm"
                onClick={onNewChat}
                className="rounded-lg"
              >
                <Plus className="w-4 h-4 me-1" /> {t("sidebar.newChatBtn")}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((conv, idx) => {
              const name = getDisplayName(conv);
              const avatarUrl = conv.type === "direct" ? conv.other_user?.avatar_url : conv.avatar_url;
              const colorClass = funColors[idx % funColors.length];
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-start",
                    "hover:bg-muted/50 active:bg-muted/70",
                    selectedId === conv.id && "bg-primary/10"
                  )}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12 shrink-0">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className={cn("text-sm font-semibold", colorClass)}>
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.type === "direct" && conv.other_user_id && isOnline(conv.other_user_id) && (
                      <span className="absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      {(conv.unread_count ?? 0) > 0 && (
                        <Badge className="ms-2 h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-primary text-primary-foreground border-0 shrink-0 rounded-full">
                          {conv.unread_count! > 99 ? "99+" : conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message || (
                        conv.type === "direct" && conv.other_user_id
                          ? isOnline(conv.other_user_id) ? t("sidebar.active") : t("sidebar.offline")
                          : conv.type === "group" ? `👥 ${t("sidebar.group")}` : t("sidebar.chat")
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
