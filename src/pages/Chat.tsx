import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
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

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const showSidebar = !isMobile || !selectedConversation;
  const showChat = !isMobile || !!selectedConversation;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {showSidebar && (
        <div className={isMobile ? "w-full" : "w-80 shrink-0"}>
          <ConversationList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            onNewChat={() => setNewChatOpen(true)}
            onSignOut={handleSignOut}
            refreshKey={refreshKey}
            isOnline={isOnline}
          />
        </div>
      )}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0">
          {isMobile && selectedConversation && (
            <div className="p-2 border-b border-border bg-card">
              <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
            </div>
          )}
          <ChatArea conversationId={selectedConversation} isOnline={isOnline} />
        </div>
      )}
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onConversationCreated={(id) => { setSelectedConversation(id); setRefreshKey((k) => k + 1); }}
      />
    </div>
  );
};

export default Chat;
