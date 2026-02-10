import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, X, ArrowLeft, Play, Square, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface CallRecord {
  id: string;
  conversation_id: string;
  caller_id: string;
  call_type: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  caller_name?: string;
  other_name?: string;
  is_outgoing: boolean;
  recording_url?: string | null;
}

interface CallHistoryProps {
  onSelectConversation?: (id: string) => void;
  onClose?: () => void;
  onStartCall?: (conversationId: string, callType: "voice" | "video") => void;
}

export function CallHistory({ onSelectConversation, onClose, onStartCall }: CallHistoryProps) {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;
    loadCalls();
  }, [user]);

  const loadCalls = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data) {
      setCalls([]);
      setLoading(false);
      return;
    }

    // Enrich with profile names
    const callerIds = [...new Set(data.map((c) => c.caller_id))];
    const conversationIds = [...new Set(data.map((c) => c.conversation_id))];

    // Get caller profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", callerIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

    // Get other members for each conversation
    const enriched = await Promise.all(
      data.map(async (call) => {
        const isOutgoing = call.caller_id === user.id;

        // Find other user in conversation
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", call.conversation_id)
          .neq("user_id", user.id)
          .limit(1);

        let otherName = "Unknown";
        if (members && members.length > 0) {
          const { data: otherProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", members[0].user_id)
            .maybeSingle();
          otherName = otherProfile?.display_name || "Unknown";
        }

        return {
          ...call,
          caller_name: profileMap.get(call.caller_id) || "Unknown",
          other_name: otherName,
          is_outgoing: isOutgoing,
        };
      })
    );

    setCalls(enriched);
    setLoading(false);
  };

  const togglePlayback = (call: CallRecord) => {
    if (!call.recording_url) return;
    if (playingId === call.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(call.recording_url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(call.id);
    }
  };

  const formatDuration = (startedAt: string | null, endedAt: string | null) => {
    if (!startedAt || !endedAt) return null;
    const secs = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const getCallIcon = (call: CallRecord) => {
    if (call.status === "missed") return <PhoneMissed className="w-4 h-4 text-destructive" />;
    if (call.status === "declined") return <PhoneMissed className="w-4 h-4 text-muted-foreground" />;
    if (call.is_outgoing) return <PhoneOutgoing className="w-4 h-4 text-primary" />;
    return <PhoneIncoming className="w-4 h-4 text-primary" />;
  };

  const getStatusLabel = (call: CallRecord) => {
    if (call.status === "missed") return call.is_outgoing ? "No answer" : "Missed";
    if (call.status === "declined") return call.is_outgoing ? "Declined" : "Declined";
    if (call.status === "ringing") return "Ringing...";
    const duration = formatDuration(call.started_at, call.ended_at);
    return duration || "Ended";
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border flex items-center gap-3">
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex items-center gap-2 flex-1">
          <Phone className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Call History</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-4xl">📞</div>
            <p className="text-sm text-muted-foreground">No calls yet</p>
            <p className="text-xs text-muted-foreground">Your call history will appear here</p>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-0.5">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectConversation?.(call.conversation_id)}
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {call.other_name?.slice(0, 2).toUpperCase() || "??"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-sm font-semibold truncate",
                      call.status === "missed" && !call.is_outgoing && "text-destructive"
                    )}>
                      {call.other_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getCallIcon(call)}
                    <span className={cn(
                      "text-xs",
                      call.status === "missed" && !call.is_outgoing ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {getStatusLabel(call)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {format(new Date(call.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Call type + actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {call.recording_url && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("w-8 h-8 rounded-full", playingId === call.id && "text-primary")}
                        onClick={(e) => { e.stopPropagation(); togglePlayback(call); }}
                        title={playingId === call.id ? "Stop playback" : "Play recording"}
                      >
                        {playingId === call.id ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <a
                        href={call.recording_url}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
                        title="Download recording"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </>
                  )}
                  {call.call_type === "video" ? (
                    <Video className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  )}
                  {onStartCall && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCall(call.conversation_id, call.call_type as "voice" | "video");
                      }}
                    >
                      <Phone className="w-3.5 h-3.5 text-primary" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
