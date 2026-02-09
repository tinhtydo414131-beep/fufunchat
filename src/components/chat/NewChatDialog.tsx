import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onConversationCreated }: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const searchUsers = async (query: string) => {
    setSearch(query);
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .neq("user_id", user?.id || "")
      .ilike("display_name", `%${query}%`)
      .limit(10);

    setResults(data || []);
    setSearching(false);
  };

  const startChat = async (otherUserId: string) => {
    if (!user || creating) return;
    setCreating(true);

    try {
      // Check if a direct conversation already exists
      const { data: myConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      const { data: theirConvs } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId);

      const myIds = new Set(myConvs?.map((c) => c.conversation_id));
      const sharedIds = theirConvs?.filter((c) => myIds.has(c.conversation_id)).map((c) => c.conversation_id) || [];

      if (sharedIds.length > 0) {
        // Check if any are direct conversations
        const { data: directConvs } = await supabase
          .from("conversations")
          .select("id")
          .in("id", sharedIds)
          .eq("type", "direct")
          .limit(1);

        if (directConvs && directConvs.length > 0) {
          onConversationCreated(directConvs[0].id);
          onOpenChange(false);
          setCreating(false);
          return;
        }
      }

      // Generate ID client-side to avoid SELECT after INSERT (RLS issue)
      const convId = crypto.randomUUID();

      // Create new direct conversation (no .select() to avoid SELECT RLS check)
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: convId, type: "direct" });

      if (convError) throw convError;

      // Add self first (RLS allows user_id = auth.uid())
      const { error: selfError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: user.id, role: "admin",
      });
      if (selfError) throw selfError;

      // Then add other user (RLS allows because we're now a member)
      const { error: otherError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: otherUserId, role: "admin",
      });
      if (otherError) throw otherError;

      toast.success("Cuộc trò chuyện mới đã được tạo ✨");
      onConversationCreated(convId);
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Chưa tạo được — thử lại nhé 💛");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Trò chuyện mới ✨
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm người dùng..."
              value={search}
              onChange={(e) => searchUsers(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {searching ? (
              <p className="text-center text-sm text-muted-foreground py-4">Đang tìm kiếm... ✨</p>
            ) : results.length === 0 && search.length >= 2 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Chưa tìm thấy ai — thử từ khóa khác nhé 💛
              </p>
            ) : (
              results.map((profile) => (
                <button
                  key={profile.user_id}
                  onClick={() => startChat(profile.user_id)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {profile.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{profile.display_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
