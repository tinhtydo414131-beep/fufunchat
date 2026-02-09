import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  is_deleted: boolean;
  created_at: string;
  sender?: { display_name: string; avatar_url: string | null };
}

interface ChatAreaProps {
  conversationId: string | null;
}

export function ChatArea({ conversationId }: ChatAreaProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    loadMessages();

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
          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", newMsg.sender_id)
            .single();
          
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: profile || undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Fetch sender profiles
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !user || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type: "text",
    });

    if (error) {
      setNewMessage(content);
    }

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    setSending(false);
    inputRef.current?.focus();
  };

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
    <div className="flex-1 flex flex-col bg-background">
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

            return (
              <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                {!isMe && (
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={msg.sender?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {msg.sender?.display_name?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                <div className={cn("max-w-[70%] space-y-1", isMe && "items-end")}>
                  {showAvatar && !isMe && (
                    <p className="text-xs text-muted-foreground font-medium pl-1">
                      {msg.sender?.display_name || "Người dùng"}
                    </p>
                  )}
                  <div
                    className={cn(
                      "px-4 py-2 rounded-2xl text-sm leading-relaxed",
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    {msg.is_deleted ? (
                      <span className="italic text-muted-foreground">Tin nhắn đã được thu hồi</span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <p className={cn("text-[10px] text-muted-foreground px-1", isMe && "text-right")}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <Smile className="w-5 h-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Nhập tin nhắn... ✨"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="bg-muted/50 border-0"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending} className="shrink-0">
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
