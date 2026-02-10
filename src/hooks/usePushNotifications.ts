import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  const getVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notify?action=vapid-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.publicKey || null;
    } catch {
      return null;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      // Register push service worker
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidKey = await getVapidKey();
        if (!vapidKey) {
          console.warn("No VAPID key available");
          return;
        }

        // Convert VAPID key to Uint8Array
        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const applicationServerKey = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          applicationServerKey[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // Send subscription to server
      const subJson = subscription.toJSON();
      const session = (await supabase.auth.getSession()).data.session;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notify?action=subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          }),
        }
      );

      subscribedRef.current = true;
      console.log("Push notifications subscribed!");
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [user, getVapidKey]);

  const sendPush = useCallback(
    async (conversationId: string, title: string, body: string) => {
      if (!user) return;
      try {
        const session = (await supabase.auth.getSession()).data.session;

        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notify?action=send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              conversationId,
              title,
              body,
              url: "/",
            }),
          }
        );
      } catch (err) {
        console.error("Send push failed:", err);
      }
    },
    [user]
  );

  // Auto-subscribe when user logs in
  useEffect(() => {
    if (user) {
      // Delay slightly so notification permission prompt isn't immediate
      const timer = setTimeout(() => subscribe(), 2000);
      return () => clearTimeout(timer);
    } else {
      subscribedRef.current = false;
    }
  }, [user, subscribe]);

  return { subscribe, sendPush };
}
