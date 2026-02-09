import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Forward, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Conversation {
  id: string;
  name: string | null;
  type: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    content: string | null;
    type: string;
    sender?: { display_name: string };
  } | null;
  currentConversationId: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  currentConversationId,
}: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [forwarding, setForwarding] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    loadConversations();
  }, [open, user]);

  const loadConversations = async () => {
    if (!user) return;

    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberships) return;

    const convIds = memberships
      .map((m) => m.conversation_id)
      .filter((id) => id !== currentConversationId);

    if (convIds.length === 0) {
      setConversations([]);
      return;
    }

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, name, type")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convs) return;

    // For direct convos, get the other user's name
    const directConvs = convs.filter((c) => c.type === "direct");
    const results: Conversation[] = [];

    if (directConvs.length > 0) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", directConvs.map((c) => c.id))
        .neq("user_id", user.id);

      const otherUserIds = [...new Set(members?.map((m) => m.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", otherUserIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      const memberMap = new Map(members?.map((m) => [m.conversation_id, m.user_id]));

      for (const conv of directConvs) {
        const otherUserId = memberMap.get(conv.id);
        const profile = otherUserId ? profileMap.get(otherUserId) : undefined;
        results.push({
          id: conv.id,
          name: conv.name,
          type: conv.type,
          displayName: profile?.display_name || "Người dùng",
          avatarUrl: profile?.avatar_url,
        });
      }
    }

    for (const conv of convs.filter((c) => c.type === "group")) {
      results.push({
        id: conv.id,
        name: conv.name,
        type: conv.type,
        displayName: conv.name || "Nhóm",
      });
    }

    setConversations(results);
  };

  const forwardTo = async (convId: string) => {
    if (!user || !message) return;
    setForwarding(convId);

    try {
      const forwardedContent =
        message.type === "text"
          ? `↪ Chuyển tiếp từ ${message.sender?.display_name || "Người dùng"}:\n${message.content}`
          : message.content;

      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: forwardedContent,
        type: message.type,
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);

      toast.success("Đã chuyển tiếp tin nhắn ✨");
      onOpenChange(false);
    } catch {
      toast.error("Không thể chuyển tiếp tin nhắn");
    } finally {
      setForwarding(null);
    }
  };

  const filtered = conversations.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-4 h-4" />
            Chuyển tiếp tin nhắn
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm cuộc trò chuyện..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Không tìm thấy cuộc trò chuyện
            </p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => forwardTo(conv.id)}
                disabled={forwarding === conv.id}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  "hover:bg-muted focus:bg-muted outline-none",
                  forwarding === conv.id && "opacity-50 pointer-events-none"
                )}
              >
                {conv.type === "group" ? (
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                ) : (
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={conv.avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {conv.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-sm font-medium truncate">{conv.displayName}</span>
                {forwarding === conv.id && (
                  <div className="ml-auto w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
