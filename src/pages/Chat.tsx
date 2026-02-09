import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { GlobalSearchDialog } from "@/components/chat/GlobalSearchDialog";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import { MobileBottomNav } from "@/components/chat/MobileBottomNav";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Chat = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isOnline } = useOnlineUsers();
  const { requestPermission } = useNotifications();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chats" | "profile" | "settings" | "search">("chats");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Mobile: handle tab changes
  const handleMobileTabChange = (tab: "chats" | "profile" | "settings" | "search") => {
    if (tab === "profile") {
      navigate("/profile");
      return;
    }
    if (tab === "settings") {
      setSettingsOpen(true);
      return;
    }
    if (tab === "search") {
      setGlobalSearchOpen(true);
      return;
    }
    setMobileTab(tab);
    setSelectedConversation(null);
  };

  // Mobile: in a conversation
  const mobileInChat = isMobile && !!selectedConversation;

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden">
        <div className="w-80 shrink-0">
          <ConversationList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            onNewChat={() => setNewChatOpen(true)}
            onSignOut={handleSignOut}
            refreshKey={refreshKey}
            isOnline={isOnline}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea conversationId={selectedConversation} isOnline={isOnline} />
        </div>
        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          onConversationCreated={(id) => { setSelectedConversation(id); setRefreshKey((k) => k + 1); }}
        />
        <GlobalSearchDialog
          open={globalSearchOpen}
          onOpenChange={setGlobalSearchOpen}
          onSelectConversation={(id) => { setSelectedConversation(id); }}
        />
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden">
      {mobileInChat ? (
        // Full-screen chat view on mobile
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-2 py-1.5 border-b border-border bg-card flex items-center gap-2 safe-area-top">
            <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)} className="shrink-0 -ml-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatArea conversationId={selectedConversation} isOnline={isOnline} />
          </div>
        </div>
      ) : (
        // Conversation list + bottom nav
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ConversationList
              selectedId={selectedConversation}
              onSelect={setSelectedConversation}
              onNewChat={() => setNewChatOpen(true)}
              onSignOut={handleSignOut}
              refreshKey={refreshKey}
              isOnline={isOnline}
            />
          </div>
          <MobileBottomNav
            activeTab={mobileTab}
            onTabChange={handleMobileTabChange}
            onNewChat={() => setNewChatOpen(true)}
          />
        </>
      )}

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onConversationCreated={(id) => { setSelectedConversation(id); setRefreshKey((k) => k + 1); }}
      />
      <GlobalSearchDialog
        open={globalSearchOpen}
        onOpenChange={setGlobalSearchOpen}
        onSelectConversation={(id) => { setSelectedConversation(id); }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default Chat;
