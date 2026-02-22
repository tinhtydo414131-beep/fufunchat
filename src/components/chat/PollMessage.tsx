import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PollMessageProps {
  pollId: string;
  isMe: boolean;
}

interface PollData {
  question: string;
  is_multiple_choice: boolean;
  is_anonymous: boolean;
  creator_id: string;
}

interface PollOption {
  id: string;
  option_text: string;
  position: number;
}

interface PollVote {
  option_id: string;
  user_id: string;
}

export function PollMessage({ pollId, isMe }: PollMessageProps) {
  const { user } = useAuth();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPoll = useCallback(async () => {
    const [pollRes, optRes, voteRes] = await Promise.all([
      supabase.from("polls" as any).select("question, is_multiple_choice, is_anonymous, creator_id").eq("id", pollId).single(),
      supabase.from("poll_options" as any).select("id, option_text, position").eq("poll_id", pollId).order("position"),
      supabase.from("poll_votes" as any).select("option_id, user_id").eq("poll_id", pollId),
    ]);

    if (pollRes.data) setPoll(pollRes.data as any);
    if (optRes.data) setOptions(optRes.data as any);
    if (voteRes.data) setVotes(voteRes.data as any);
    setLoading(false);
  }, [pollId]);

  useEffect(() => {
    loadPoll();

    // Realtime votes subscription
    const channel = supabase
      .channel(`poll-votes-${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, () => {
        // Reload votes
        supabase.from("poll_votes" as any).select("option_id, user_id").eq("poll_id", pollId).then(({ data }) => {
          if (data) setVotes(data as any);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pollId, loadPoll]);

  const toggleVote = async (optionId: string) => {
    if (!user || !poll) return;

    const myVoteForOption = votes.find((v) => v.option_id === optionId && v.user_id === user.id);

    if (myVoteForOption) {
      // Remove vote
      await supabase.from("poll_votes" as any).delete().eq("poll_id", pollId).eq("option_id", optionId).eq("user_id", user.id);
      setVotes((prev) => prev.filter((v) => !(v.option_id === optionId && v.user_id === user.id)));
    } else {
      if (!poll.is_multiple_choice) {
        // Remove previous vote first
        const myPrevVote = votes.find((v) => v.user_id === user.id);
        if (myPrevVote) {
          await supabase.from("poll_votes" as any).delete().eq("poll_id", pollId).eq("user_id", user.id);
          setVotes((prev) => prev.filter((v) => v.user_id !== user.id));
        }
      }
      // Add vote
      const { error } = await supabase.from("poll_votes" as any).insert({ poll_id: pollId, option_id: optionId, user_id: user.id });
      if (error) {
        toast.error("Không thể vote");
        return;
      }
      setVotes((prev) => [...prev, { option_id: optionId, user_id: user.id }]);
    }
  };

  if (loading || !poll) {
    return <div className="text-xs text-muted-foreground px-2 py-1">Đang tải bình chọn...</div>;
  }

  const totalVotes = votes.length;
  const uniqueVoters = new Set(votes.map((v) => v.user_id)).size;

  return (
    <div className="min-w-[220px] max-w-[320px] space-y-2">
      <div className="flex items-start gap-2">
        <BarChart3 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm font-semibold leading-tight">{poll.question}</p>
      </div>

      <div className="space-y-1.5">
        {options.map((opt) => {
          const optVotes = votes.filter((v) => v.option_id === opt.id).length;
          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
          const myVoted = votes.some((v) => v.option_id === opt.id && v.user_id === user?.id);

          return (
            <button
              key={opt.id}
              onClick={() => toggleVote(opt.id)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2 relative overflow-hidden transition-all text-sm",
                myVoted
                  ? "ring-2 ring-primary/50 bg-primary/10"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/15 transition-all duration-500 ease-out rounded-lg"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  {myVoted && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  <span className="truncate">{opt.option_text}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0 font-medium">
                  {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
        <Users className="w-3 h-3" />
        <span>{uniqueVoters} người đã vote · {totalVotes} lượt</span>
        {poll.is_multiple_choice && <span>· Chọn nhiều</span>}
        {poll.is_anonymous && <span>· Ẩn danh</span>}
      </div>
    </div>
  );
}
