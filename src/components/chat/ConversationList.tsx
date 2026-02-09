import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Search, Plus, LogOut, Sparkles, User, SearchCheck, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "./SettingsDialog";
import { useTranslation } from "@/hooks/useI18n";

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
}

function getLastReadKey(userId: string, convId: string) {
  return `lastRead:${userId}:${convId}`;
}

export function markConversationRead(userId: string, convId: string) {
  localStorage.setItem(getLastReadKey(userId, convId), new Date().toISOString());
}

export function ConversationList({ selectedId, onSelect, onNewChat, onSignOut, refreshKey, isOnline, onGlobalSearch }: ConversationListProps) {
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

    // For direct chats, get the other user's profile
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

    // Fetch last message + unread count per conversation
    const enrichedWithExtra = await Promise.all(
      (enriched as Conversation[]).map(async (conv) => {
        // Last message
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
            last_message = "Tin nhắn đã thu hồi";
          } else if (lm.type === "image") {
            last_message = "📷 Ảnh";
          } else if (lm.type === "file") {
            last_message = "📎 Tệp";
          } else if (lm.type === "voice") {
            last_message = "🎤 Tin nhắn thoại";
          } else {
            last_message = lm.content || "";
          }
          // Prefix with "Bạn: " if sent by current user
          if (lm.sender_id === user.id && !lm.is_deleted) {
            last_message = `Bạn: ${last_message}`;
          }
        }

        // Unread count
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
    return c.name || "Cuộc trò chuyện";
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-sidebar-background border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-bold font-[Quicksand]">FUN Chat</h2>
            <Sparkles className="w-4 h-4 text-primary/60" />
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} title={t("sidebar.profile")}>
              <User className="w-5 h-5" />
            </Button>
            {onGlobalSearch && (
              <Button variant="ghost" size="icon" onClick={onGlobalSearch} title={t("sidebar.globalSearch")}>
                <SearchCheck className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onNewChat} title={t("sidebar.newChat")}>
              <Plus className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title={t("sidebar.settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} title={t("sidebar.signOut")}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("sidebar.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {t("sidebar.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? t("sidebar.noResults") : t("sidebar.startFirst")}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={onNewChat}>
                <Plus className="w-4 h-4 mr-1" /> {t("sidebar.newChatBtn")}
              </Button>
            )}
          </div>
        ) : (
          <div className="px-2 pb-2">
            {filtered.map((conv) => {
              const name = getDisplayName(conv);
              const avatarUrl = conv.type === "direct" ? conv.other_user?.avatar_url : conv.avatar_url;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    "hover:bg-sidebar-accent",
                    selectedId === conv.id && "bg-sidebar-accent"
                  )}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.type === "direct" && conv.other_user_id && isOnline(conv.other_user_id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-sidebar-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      {(conv.unread_count ?? 0) > 0 && (
                        <Badge className="ml-2 h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-primary text-primary-foreground shrink-0">
                          {conv.unread_count! > 99 ? "99+" : conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.last_message || (
                        conv.type === "direct" && conv.other_user_id
                          ? isOnline(conv.other_user_id) ? t("sidebar.active") : t("sidebar.offline")
                          : conv.type === "group" ? t("sidebar.group") : t("sidebar.chat")
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
