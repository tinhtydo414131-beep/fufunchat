import { MessageCircle, User, Settings, Phone, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useI18n";

interface MobileBottomNavProps {
  activeTab: "chats" | "calls" | "profile" | "settings" | "search";
  onTabChange: (tab: "chats" | "calls" | "profile" | "settings" | "search") => void;
  onNewChat: () => void;
  unreadTotal?: number;
}

export function MobileBottomNav({ activeTab, onTabChange, onNewChat, unreadTotal }: MobileBottomNavProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: "chats" as const, icon: MessageCircle, label: t("sidebar.chats") || "Chats", badge: unreadTotal },
    { id: "calls" as const, icon: Phone, label: "Calls" },
    { id: "profile" as const, icon: User, label: t("sidebar.profile") || "Profile" },
    { id: "settings" as const, icon: Settings, label: t("sidebar.settings") || "Settings" },
  ];

  return (
    <>
      {/* Telegram-style FAB */}
      <button
        onClick={onNewChat}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform"
        aria-label="New chat"
      >
        <Pencil className="w-6 h-6" />
      </button>

      <nav className="flex items-center justify-around border-t border-border bg-card px-1 py-1.5 safe-area-bottom">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as "chats" | "calls" | "profile" | "settings" | "search")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-all relative",
                isActive && "text-primary",
                !isActive && "text-muted-foreground active:scale-95"
              )}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
