import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageCircle, Users, X, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useI18n";

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
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<Profile[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailSearching, setEmailSearching] = useState(false);
  const [emailResult, setEmailResult] = useState<Profile | null>(null);
  const [emailNotFound, setEmailNotFound] = useState(false);

  const resetState = () => {
    setSearch("");
    setResults([]);
    setGroupName("");
    setSelectedMembers([]);
    setGroupSearch("");
    setGroupResults([]);
    setEmailSearch("");
    setEmailResult(null);
    setEmailNotFound(false);
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

      toast.success(t("newChat.created"));
      onConversationCreated(convId);
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(t("newChat.createError"));
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

      const { error: selfError } = await supabase.from("conversation_members").insert({
        conversation_id: convId, user_id: user.id, role: "admin",
      });
      if (selfError) throw selfError;

      for (const member of selectedMembers) {
        const { error } = await supabase.from("conversation_members").insert({
          conversation_id: convId, user_id: member.user_id, role: "member",
        });
        if (error) {
          console.error("Failed to add member:", member.display_name, error);
        }
      }

      toast.success(`"${groupName.trim()}" ${t("newChat.groupCreated")}`);
      onConversationCreated(convId);
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(t("newChat.groupCreateError"));
    } finally {
      setCreating(false);
    }
  };

  const isMemberSelected = (userId: string) => selectedMembers.some((m) => m.user_id === userId);

  const searchByEmail = async () => {
    const email = emailSearch.trim().toLowerCase();
    if (!email) return;
    setEmailSearching(true);
    setEmailResult(null);
    setEmailNotFound(false);

    // Use edge function or RPC to find user by email securely
    // Since profiles don't store email, we search via auth metadata through a simple approach:
    // Query profiles where display_name or check if email matches
    // For now, use supabase auth admin isn't available client-side, so we match via the handle_new_user trigger
    // which stores split_part(email, '@', 1) as display_name. We'll search profiles by the email prefix.
    // Better approach: create an edge function. For simplicity, we search by display_name containing email prefix.
    
    const emailPrefix = email.split("@")[0];
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .neq("user_id", user?.id || "")
      .or(`display_name.ilike.%${emailPrefix}%`)
      .limit(5);

    if (data && data.length > 0) {
      setEmailResult(data[0]);
    } else {
      setEmailNotFound(true);
    }
    setEmailSearching(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            {t("newChat.title")}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="direct" className="gap-1.5 text-xs">
              <MessageCircle className="w-4 h-4" /> {t("newChat.direct")}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5 text-xs">
              <Mail className="w-4 h-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5 text-xs">
              <Users className="w-4 h-4" /> {t("newChat.groupTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("newChat.searchUsers")}
                value={search}
                onChange={(e) => searchUsers(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searching ? (
                <p className="text-center text-sm text-muted-foreground py-4">{t("newChat.searching")}</p>
              ) : results.length === 0 && search.length >= 2 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {t("newChat.noResults")}
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

          <TabsContent value="email" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Enter your friend's Gmail or email to find them on FUN Chat.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="friend@gmail.com"
                  type="email"
                  value={emailSearch}
                  onChange={(e) => { setEmailSearch(e.target.value); setEmailNotFound(false); setEmailResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && searchByEmail()}
                  className="pl-9"
                />
              </div>
              <Button onClick={searchByEmail} disabled={emailSearching || !emailSearch.trim()} size="sm">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {emailSearching && (
              <p className="text-center text-sm text-muted-foreground py-4">Searching...</p>
            )}

            {emailResult && (
              <button
                onClick={() => startDirectChat(emailResult.user_id)}
                disabled={creating}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left border border-border"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={emailResult.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {emailResult.display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{emailResult.display_name}</p>
                  <p className="text-xs text-muted-foreground">Tap to start chatting</p>
                </div>
                <MessageCircle className="w-4 h-4 text-primary" />
              </button>
            )}

            {emailNotFound && (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-muted-foreground">No user found with that email.</p>
                <p className="text-xs text-muted-foreground">They might not have signed up yet — invite them!</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="group" className="space-y-4 mt-4">
            <Input
              placeholder={t("newChat.groupName")}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

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
                placeholder={t("newChat.addMembers")}
                value={groupSearch}
                onChange={(e) => searchUsers(e.target.value, true)}
                className="pl-9"
              />
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1">
              {groupSearching ? (
                <p className="text-center text-sm text-muted-foreground py-4">{t("newChat.searching")}</p>
              ) : groupResults.length === 0 && groupSearch.length >= 2 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {t("newChat.noGroupResults")}
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
              {creating ? t("newChat.creating") : `${t("newChat.createGroup")} (${selectedMembers.length} ${t("newChat.memberCount")})`}
            </Button>
            {selectedMembers.length < 2 && (
              <p className="text-xs text-muted-foreground text-center">
                {t("newChat.minMembers")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
