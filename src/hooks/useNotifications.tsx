import { useEffect, useRef, useCallback } from "react";

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!("Notification" in window)) return;
    permissionRef.current = Notification.permission;
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    permissionRef.current = result;
    return result === "granted";
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.hasFocus()) return; // Don't notify if app is focused

    const notification = new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5s
    setTimeout(() => notification.close(), 5000);
  }, []);

  return { requestPermission, sendNotification };
}
