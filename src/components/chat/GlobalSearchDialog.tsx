import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageCircle, Filter, ChevronDown, ChevronUp, Image as ImageIcon, FileText, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  conversation_id: string;
  sender_name: string;
  conv_name: string;
  type: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (conversationId: string) => void;
}

const MSG_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "text", label: "Text" },
  { value: "image", label: "Images" },
  { value: "file", label: "Files" },
  { value: "voice", label: "Voice" },
];

const MSG_TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-3 h-3" />,
  file: <FileText className="w-3 h-3" />,
  voice: <Mic className="w-3 h-3" />,
};

export function GlobalSearchDialog({ open, onOpenChange, onSelectConversation }: GlobalSearchDialogProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [senderFilter, setSenderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Known senders from results for the filter dropdown
  const [knownSenders, setKnownSenders] = useState<{ user_id: string; display_name: string }[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSenderFilter("all");
      setTypeFilter("all");
      setDateFrom("");
      setDateTo("");
      setShowFilters(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      loadKnownSenders();
    }
  }, [open]);

  const loadKnownSenders = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    if (!memberships?.length) return;
    const convIds = memberships.map((m) => m.conversation_id);
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .in("conversation_id", convIds);
    if (!members) return;
    const uniqueIds = [...new Set(members.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", uniqueIds);
    if (profiles) setKnownSenders(profiles);
  }, [user]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() && typeFilter === "all" && senderFilter === "all" && !dateFrom && !dateTo) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchMessages(), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, senderFilter, typeFilter, dateFrom, dateTo, user]);

  const searchMessages = async () => {
    if (!user) return;
    setSearching(true);

    try {
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!memberships?.length) {
        setResults([]);
        setSearching(false);
        return;
      }

      const convIds = memberships.map((m) => m.conversation_id);

      let q = supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, sender_id, type")
        .in("conversation_id", convIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(30);

      // Apply text filter
      if (query.trim()) {
        q = q.ilike("content", `%${query.trim()}%`);
      }

      // Apply type filter
      if (typeFilter !== "all") {
        q = q.eq("type", typeFilter);
      }

      // Apply sender filter
      if (senderFilter !== "all") {
        q = q.eq("sender_id", senderFilter);
      }

      // Apply date range
      if (dateFrom) {
        q = q.gte("created_at", `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        q = q.lte("created_at", `${dateTo}T23:59:59`);
      }

      const { data: messages } = await q;

      if (!messages?.length) {
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
          type: m.type,
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

  const activeFilterCount = [
    senderFilter !== "all",
    typeFilter !== "all",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSenderFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const getTypeLabel = (type: string) => {
    if (type === "image") return "📷 Image";
    if (type === "file") return "📎 File";
    if (type === "voice") return "🎤 Voice";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            {t("globalSearch.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={t("globalSearch.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-10"
          />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0",
              activeFilterCount > 0 && "text-primary"
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {/* Sender filter */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sender</label>
              <Select value={senderFilter} onValueChange={setSenderFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All senders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All senders</SelectItem>
                  {knownSenders.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.user_id === user?.id ? `${s.display_name} (You)` : s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message type filter */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Message type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  {MSG_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[350px] overflow-y-auto space-y-1">
          {searching && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && (query.trim() || activeFilterCount > 0) && results.length === 0 && (
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
                  {r.type === "image" ? (
                    <ImageIcon className="w-4 h-4 text-primary" />
                  ) : r.type === "file" ? (
                    <FileText className="w-4 h-4 text-primary" />
                  ) : r.type === "voice" ? (
                    <Mic className="w-4 h-4 text-primary" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{r.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(r.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm truncate">
                    {r.type !== "text" ? (
                      <span className="text-muted-foreground">{getTypeLabel(r.type)} </span>
                    ) : null}
                    {highlightMatch(r.content, query)}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{t("globalSearch.in")} {r.conv_name}</p>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
