import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMinus, UserPlus, Pencil, Check, X, Search, Crown, Shield } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useI18n";

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface GroupManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onUpdated: () => void;
}

export function GroupManagementDialog({ open, onOpenChange, conversationId, onUpdated }: GroupManagementDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [groupName, setGroupName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [myRole, setMyRole] = useState("member");

  useEffect(() => {
    if (open && conversationId) {
      loadMembers();
      loadGroupName();
    }
  }, [open, conversationId]);

  const loadGroupName = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("name")
      .eq("id", conversationId)
      .maybeSingle();
    if (data?.name) {
      setGroupName(data.name);
      setNewName(data.name);
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    const { data: memberData } = await supabase
      .from("conversation_members")
      .select("id, user_id, role")
      .eq("conversation_id", conversationId);

    if (memberData && memberData.length > 0) {
      const userIds = memberData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      const enriched = memberData.map((m) => ({
        ...m,
        display_name: profileMap.get(m.user_id)?.display_name || t("chat.user"),
        avatar_url: profileMap.get(m.user_id)?.avatar_url || null,
      }));
      setMembers(enriched);

      const me = memberData.find((m) => m.user_id === user?.id);
      setMyRole(me?.role || "member");
    }
    setLoading(false);
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from("conversations")
      .update({ name: newName.trim() })
      .eq("id", conversationId);

    if (error) {
      toast.error(t("groupMgmt.renameError"));
    } else {
      setGroupName(newName.trim());
      setEditingName(false);
      toast.success(t("groupMgmt.renamed"));
      onUpdated();
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .ilike("display_name", `%${query.trim()}%`)
      .limit(10);

    const memberIds = new Set(members.map((m) => m.user_id));
    setSearchResults((data || []).filter((p) => !memberIds.has(p.user_id) && p.user_id !== user?.id));
    setSearching(false);
  };

  const addMember = async (profile: Profile) => {
    const { error } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: profile.user_id, role: "member" });

    if (error) {
      toast.error(t("groupMgmt.addError"));
    } else {
      toast.success(`${t("groupMgmt.added")} ${profile.display_name} ✨`);
      setSearchQuery("");
      setSearchResults([]);
      loadMembers();
      onUpdated();
    }
  };

  const removeMember = async (member: Member) => {
    if (member.user_id === user?.id) {
      toast.error(t("groupMgmt.cantRemoveSelf"));
      return;
    }
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      toast.error(t("groupMgmt.removeError"));
    } else {
      toast.success(`${t("groupMgmt.removed")} ${member.display_name}`);
      loadMembers();
      onUpdated();
    }
  };

  const isAdmin = myRole === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("groupMgmt.title")}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="members" className="mt-2">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="members">{t("groupMgmt.membersTab")} ({members.length})</TabsTrigger>
            <TabsTrigger value="settings">{t("groupMgmt.settingsTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-3 mt-3">
            {isAdmin && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("groupMgmt.searchAdd")}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="ps-9"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => addMember(p)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-muted transition-colors text-start"
                      >
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {p.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">{p.display_name}</span>
                        <UserPlus className="w-4 h-4 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {member.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.display_name}
                        {member.user_id === user?.id && (
                          <span className="text-xs text-muted-foreground ms-1">{t("groupMgmt.you")}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        {member.role === "admin" && (
                          <span className="text-[10px] text-primary flex items-center gap-0.5">
                            <Crown className="w-3 h-3" /> {t("groupMgmt.admin")}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && member.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 w-7 h-7 text-destructive hover:text-destructive"
                        onClick={() => removeMember(member)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("groupMgmt.groupName")}</label>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    maxLength={50}
                  />
                  <Button size="icon" variant="ghost" onClick={handleRename} disabled={!newName.trim()}>
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingName(false); setNewName(groupName); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm flex-1">{groupName || t("groupMgmt.noName")}</p>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => setEditingName(true)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!isAdmin && (
              <p className="text-xs text-muted-foreground">{t("groupMgmt.adminOnly")}</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
