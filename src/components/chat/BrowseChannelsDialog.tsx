import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Megaphone, Users, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";

interface Channel {
  id: string;
  name: string | null;
  description: string | null;
  member_count: number;
  is_joined: boolean;
}

interface BrowseChannelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelSelected: (id: string) => void;
}

export function BrowseChannelsDialog({ open, onOpenChange, onChannelSelected }: BrowseChannelsDialogProps) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) loadChannels();
  }, [open, user]);

  const loadChannels = async () => {
    if (!user) return;
    setLoading(true);

    // Get all public channels
    const { data: convData } = await supabase
      .from("conversations")
      .select("id, name, description")
      .eq("type", "channel")
      .eq("is_public", true)
      .order("updated_at", { ascending: false });

    if (!convData) {
      setChannels([]);
      setLoading(false);
      return;
    }

    // Get member counts and check membership
    const enriched = await Promise.all(
      convData.map(async (conv) => {
        const { count } = await supabase
          .from("conversation_members")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id);

        const { data: membership } = await supabase
          .from("conversation_members")
          .select("id")
          .eq("conversation_id", conv.id)
          .eq("user_id", user.id)
          .maybeSingle();

        return {
          id: conv.id,
          name: conv.name,
          description: conv.description,
          member_count: count || 0,
          is_joined: !!membership,
        };
      })
    );

    setChannels(enriched);
    setLoading(false);
  };

  const joinChannel = async (channelId: string) => {
    if (!user || joining) return;
    setJoining(channelId);

    const { error } = await supabase.from("conversation_members").insert({
      conversation_id: channelId,
      user_id: user.id,
      role: "member",
    });

    if (error) {
      toast.error("Failed to join channel");
    } else {
      toast.success("📢 Joined channel!");
      setChannels((prev) =>
        prev.map((c) => c.id === channelId ? { ...c, is_joined: true, member_count: c.member_count + 1 } : c)
      );
    }
    setJoining(null);
  };

  const leaveChannel = async (channelId: string) => {
    if (!user || joining) return;
    setJoining(channelId);

    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", channelId)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to leave channel");
    } else {
      toast.success("Left channel");
      setChannels((prev) =>
        prev.map((c) => c.id === channelId ? { ...c, is_joined: false, member_count: Math.max(0, c.member_count - 1) } : c)
      );
    }
    setJoining(null);
  };

  const filtered = channels.filter((c) =>
    !search || (c.name && c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Browse Channels
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading channels...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Megaphone className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {search ? "No channels found" : "No public channels yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{channel.name || "Channel"}</p>
                    {channel.description && (
                      <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{channel.member_count} subscribers</span>
                    </div>
                  </div>
                  {channel.is_joined ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                          onChannelSelected(channel.id);
                          onOpenChange(false);
                        }}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-destructive hover:text-destructive"
                        onClick={() => leaveChannel(channel.id)}
                        disabled={joining === channel.id}
                      >
                        Leave
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => joinChannel(channel.id)}
                      disabled={joining === channel.id}
                    >
                      <UserPlus className="w-3 h-3" />
                      Join
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
