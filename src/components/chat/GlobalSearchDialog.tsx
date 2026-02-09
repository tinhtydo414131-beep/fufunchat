import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "@/hooks/useI18n";

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  conversation_id: string;
  sender_name: string;
  conv_name: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function GlobalSearchDialog({ open, onOpenChange, onSelectConversation }: GlobalSearchDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !user) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchMessages(query.trim()), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, user]);

  const searchMessages = async (q: string) => {
    if (!user) return;
    setSearching(true);

    try {
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      const convIds = memberships.map((m) => m.conversation_id);

      const { data: messages } = await supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, sender_id")
        .in("conversation_id", convIds)
        .eq("type", "text")
        .eq("is_deleted", false)
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!messages || messages.length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      const senderIds = [...new Set(messages.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", senderIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      const uniqueConvIds = [...new Set(messages.map((m) => m.conversation_id))];
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, name, type")
        .in("id", uniqueConvIds);

      const directConvIds = convs?.filter((c) => c.type === "direct").map((c) => c.id) || [];
      let directNameMap = new Map<string, string>();
      if (directConvIds.length > 0) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", directConvIds)
          .neq("user_id", user.id);
        const otherUserIds = [...new Set(members?.map((m) => m.user_id) || [])];
        if (otherUserIds.length > 0) {
          const { data: otherProfiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", otherUserIds);
          const otherMap = new Map(otherProfiles?.map((p) => [p.user_id, p.display_name]) || []);
          members?.forEach((m) => {
            const name = otherMap.get(m.user_id);
            if (name) directNameMap.set(m.conversation_id, name);
          });
        }
      }

      const convNameMap = new Map(
        convs?.map((c) => [
          c.id,
          c.type === "direct" ? directNameMap.get(c.id) || t("sidebar.chat") : c.name || t("sidebar.group"),
        ]) || []
      );

      setResults(
        messages.map((m) => ({
          id: m.id,
          content: m.content || "",
          created_at: m.created_at,
          conversation_id: m.conversation_id,
          sender_name: profileMap.get(m.sender_id) || t("chat.user"),
          conv_name: convNameMap.get(m.conversation_id) || t("sidebar.chat"),
        }))
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelectConversation(result.conversation_id);
    onOpenChange(false);
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <>
        {before}
        <span className="bg-primary/20 text-primary font-semibold rounded-sm px-0.5">{match}</span>
        {after}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            {t("globalSearch.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={t("globalSearch.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[350px] overflow-y-auto space-y-1">
          {searching && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("globalSearch.noResults")}
            </p>
          )}
          {!searching &&
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-muted focus:bg-muted outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{r.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(r.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm truncate">{highlightMatch(r.content, query)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t("globalSearch.in")} {r.conv_name}</p>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
