import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageCircle, Users, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // Group chat state
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<Profile[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);

  const resetState = () => {
    setSearch("");
    setResults([]);
    setGroupName("");
    setSelectedMembers([]);
    setGroupSearch("");
    setGroupResults([]);
  };

  const searchUsers = async (query: string, isGroup = false) => {
    if (isGroup) {
      setGroupSearch(query);
    } else {
      setSearch(query);
    }

    if (query.length < 2) {
      if (isGroup) setGroupResults([]);
      else setResults([]);
      return;
    }

    if (isGroup) setGroupSearching(true);
    else setSearching(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .neq("user_id", user?.id || "")
      .ilike("display_name", `%${query}%`)
      .limit(10);

    if (isGroup) {
      setGroupResults(data || []);
      setGroupSearching(false);
    } else {
      setResults(data || []);
      setSearching(false);
    }
  };

  const startDirectChat = async (otherUserId: string) => {
    if (!user || creating) return;
    setCreating(true);

    try {
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
        const { data: directConvs } = await supabase
          .from("conversations")
          .select("id")
          .in("id", sharedIds)
          .eq("type", "direct")
          .limit(1);

        if (directConvs && directConvs.length > 0) {
          onConversationCreated(directConvs[0].id);
          onOpenChange(false);
          resetState();
          setCreating(false);
          return;
        }
      }

      const convId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: convId, type: "direct" });
      if (convError) throw convError;

      const { error: selfError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: user.id, role: "admin",
      });
      if (selfError) throw selfError;

      const { error: otherError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: otherUserId, role: "admin",
      });
      if (otherError) throw otherError;

      toast.success("Cuộc trò chuyện mới đã được tạo ✨");
      onConversationCreated(convId);
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error("Chưa tạo được — thử lại nhé 💛");
    } finally {
      setCreating(false);
    }
  };

  const toggleMember = (profile: Profile) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.user_id === profile.user_id);
      if (exists) return prev.filter((m) => m.user_id !== profile.user_id);
      return [...prev, profile];
    });
  };

  const createGroupChat = async () => {
    if (!user || creating || selectedMembers.length < 2 || !groupName.trim()) return;
    setCreating(true);

    try {
      const convId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: convId, type: "group", name: groupName.trim() });
      if (convError) throw convError;

      // Add self first
      const { error: selfError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: user.id, role: "admin",
      });
      if (selfError) throw selfError;

      // Add each member sequentially (RLS requires creator to be member first)
      for (const member of selectedMembers) {
        const { error } = await supabase.from("conversation_members").insert({
          conversation_id: convId, user_id: member.user_id, role: "member",
        });
        if (error) {
          console.error("Failed to add member:", member.display_name, error);
        }
      }

      toast.success(`Nhóm "${groupName.trim()}" đã được tạo ✨`);
      onConversationCreated(convId);
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error("Chưa tạo nhóm được — thử lại nhé 💛");
    } finally {
      setCreating(false);
    }
  };

  const isMemberSelected = (userId: string) => selectedMembers.some((m) => m.user_id === userId);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Trò chuyện mới ✨
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="direct" className="gap-1.5">
              <MessageCircle className="w-4 h-4" /> Cá nhân
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5">
              <Users className="w-4 h-4" /> Nhóm
            </TabsTrigger>
          </TabsList>

          {/* Direct Chat Tab */}
          <TabsContent value="direct" className="space-y-4 mt-4">
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
                    onClick={() => startDirectChat(profile.user_id)}
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
          </TabsContent>

          {/* Group Chat Tab */}
          <TabsContent value="group" className="space-y-4 mt-4">
            <Input
              placeholder="Tên nhóm ✨"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((member) => (
                  <span
                    key={member.user_id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {member.display_name}
                    <button onClick={() => toggleMember(member)} className="hover:bg-primary/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm và thêm thành viên..."
                value={groupSearch}
                onChange={(e) => searchUsers(e.target.value, true)}
                className="pl-9"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1">
              {groupSearching ? (
                <p className="text-center text-sm text-muted-foreground py-4">Đang tìm kiếm... ✨</p>
              ) : groupResults.length === 0 && groupSearch.length >= 2 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Chưa tìm thấy ai 💛
                </p>
              ) : (
                groupResults.map((profile) => {
                  const selected = isMemberSelected(profile.user_id);
                  return (
                    <button
                      key={profile.user_id}
                      onClick={() => toggleMember(profile)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                        selected ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {profile.display_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium flex-1">{profile.display_name}</span>
                      {selected && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            <Button
              onClick={createGroupChat}
              disabled={creating || selectedMembers.length < 2 || !groupName.trim()}
              className="w-full"
            >
              <Users className="w-4 h-4 mr-2" />
              {creating ? "Đang tạo..." : `Tạo nhóm (${selectedMembers.length} thành viên)`}
            </Button>
            {selectedMembers.length < 2 && (
              <p className="text-xs text-muted-foreground text-center">
                Cần ít nhất 2 thành viên để tạo nhóm 💛
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
