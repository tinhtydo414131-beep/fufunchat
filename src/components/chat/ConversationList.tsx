import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Search, Plus, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  other_user?: { display_name: string; avatar_url: string | null };
  last_message?: string;
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewChat, onSignOut }: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

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

            return { ...conv, other_user: profile || undefined };
          }
        }
        return conv;
      })
    );

    setConversations(enriched as Conversation[]);
    setLoading(false);
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
            <Button variant="ghost" size="icon" onClick={onNewChat} title="Trò chuyện mới">
              <Plus className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} title="Đăng xuất">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm cuộc trò chuyện 💛"
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
            Đang tải... ✨
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "Chưa tìm thấy kết quả — thử từ khóa khác nhé 💛"
                : "Bắt đầu cuộc trò chuyện đầu tiên nào! ✨"}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={onNewChat}>
                <Plus className="w-4 h-4 mr-1" /> Chat mới
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
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    "hover:bg-sidebar-accent",
                    selectedId === conv.id && "bg-sidebar-accent"
                  )}
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.type === "group" ? "Nhóm" : "Trò chuyện"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
