import { MessageCircle, User, Settings, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useI18n";

interface MobileBottomNavProps {
  activeTab: "chats" | "profile" | "settings" | "search";
  onTabChange: (tab: "chats" | "profile" | "settings" | "search") => void;
  onNewChat: () => void;
  unreadTotal?: number;
}

export function MobileBottomNav({ activeTab, onTabChange, onNewChat, unreadTotal }: MobileBottomNavProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: "chats" as const, icon: MessageCircle, label: t("sidebar.chats") || "Chats", badge: unreadTotal },
    { id: "search" as const, icon: Search, label: t("sidebar.globalSearch") || "Search" },
    { id: "new" as const, icon: Plus, label: t("sidebar.newChatBtn") || "New" },
    { id: "profile" as const, icon: User, label: t("sidebar.profile") || "Profile" },
    { id: "settings" as const, icon: Settings, label: t("sidebar.settings") || "Settings" },
  ];

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-1 py-1.5 safe-area-bottom">
      {tabs.map((tab) => {
        const isNew = tab.id === "new";
        const isActive = !isNew && activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (isNew) {
                onNewChat();
              } else {
                onTabChange(tab.id as "chats" | "profile" | "settings" | "search");
              }
            }}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative",
              isNew && "bg-primary text-primary-foreground rounded-full p-2.5 -mt-4 shadow-lg",
              isActive && "text-primary",
              !isActive && !isNew && "text-muted-foreground"
            )}
          >
            <div className="relative">
              <tab.icon className={cn("w-5 h-5", isNew && "w-5 h-5")} />
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </div>
            {!isNew && (
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
