import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StatusType = "online" | "away" | "busy" | "offline";

export interface UserStatus {
  status: StatusType;
  custom_text: string;
}

const STATUS_LABELS: Record<StatusType, string> = {
  online: "Đang hoạt động",
  away: "Vắng mặt",
  busy: "Bận",
  offline: "Ngoại tuyến",
};

const STATUS_EMOJI: Record<StatusType, string> = {
  online: "🟢",
  away: "🟡",
  busy: "🔴",
  offline: "⚫",
};

export { STATUS_LABELS, STATUS_EMOJI };

export function useUserStatus() {
  const { user } = useAuth();
  const [myStatus, setMyStatus] = useState<UserStatus>({ status: "online", custom_text: "" });
  const [statusMap, setStatusMap] = useState<Map<string, UserStatus>>(new Map());

  // Load own status on mount
  useEffect(() => {
    if (!user) return;
    loadMyStatus();
  }, [user?.id]);

  // Subscribe to realtime status changes
  useEffect(() => {
    const channel = supabase
      .channel("user-statuses-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_statuses" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row?.user_id) return;
          setStatusMap((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              next.delete(row.user_id);
            } else {
              next.set(row.user_id, { status: row.status, custom_text: row.custom_text || "" });
            }
            return next;
          });
          if (row.user_id === user?.id) {
            setMyStatus({ status: row.status, custom_text: row.custom_text || "" });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const loadMyStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_statuses")
      .select("status, custom_text")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setMyStatus({ status: data.status as StatusType, custom_text: data.custom_text || "" });
    }
  };

  const updateStatus = useCallback(async (status: StatusType, customText?: string) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      status,
      custom_text: customText ?? myStatus.custom_text,
      updated_at: new Date().toISOString(),
    };
    await supabase
      .from("user_statuses")
      .upsert(payload, { onConflict: "user_id" });
    setMyStatus({ status, custom_text: payload.custom_text });
  }, [user, myStatus.custom_text]);

  const getUserStatus = useCallback(async (userId: string): Promise<UserStatus> => {
    const cached = statusMap.get(userId);
    if (cached) return cached;
    const { data } = await supabase
      .from("user_statuses")
      .select("status, custom_text")
      .eq("user_id", userId)
      .maybeSingle();
    const result: UserStatus = data
      ? { status: data.status as StatusType, custom_text: data.custom_text || "" }
      : { status: "offline", custom_text: "" };
    setStatusMap((prev) => new Map(prev).set(userId, result));
    return result;
  }, [statusMap]);

  return { myStatus, updateStatus, getUserStatus, statusMap, STATUS_LABELS, STATUS_EMOJI };
}
