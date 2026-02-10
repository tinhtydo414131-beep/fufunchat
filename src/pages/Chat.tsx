import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { useCall } from "@/hooks/useCall";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { GlobalSearchDialog } from "@/components/chat/GlobalSearchDialog";
import { SettingsDialog } from "@/components/chat/SettingsDialog";
import { MobileBottomNav } from "@/components/chat/MobileBottomNav";
import { IncomingCallDialog } from "@/components/chat/IncomingCallDialog";
import { ActiveCallOverlay } from "@/components/chat/ActiveCallOverlay";
import { CallHistory } from "@/components/chat/CallHistory";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone } from "lucide-react";

const Chat = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isOnline } = useOnlineUsers();
  const { requestPermission } = useNotifications();
  const {
    activeCall,
    incomingCall,
    callDuration,
    formatCallDuration,
    isMuted: callMuted,
    isVideoEnabled,
    isSpeaker,
    isScreenSharing,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute: toggleCallMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    localStreamRef,
    remoteStreamRef,
  } = useCall();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chats" | "calls" | "profile" | "settings" | "search">("chats");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleMobileTabChange = (tab: "chats" | "calls" | "profile" | "settings" | "search") => {
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
    if (tab === "calls") {
      setMobileTab(tab);
      setSelectedConversation(null);
      return;
    }
    setMobileTab(tab);
    setSelectedConversation(null);
  };

  const handleStartCall = (conversationId: string, callType: "voice" | "video") => {
    startCall(conversationId, callType);
  };

  const mobileInChat = isMobile && !!selectedConversation;

  // Desktop layout
  if (!isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <div className="w-80 shrink-0 flex flex-col">
          {showCallHistory ? (
            <CallHistory
              onSelectConversation={(id) => { setSelectedConversation(id); setShowCallHistory(false); }}
              onClose={() => setShowCallHistory(false)}
              onStartCall={handleStartCall}
            />
          ) : (
            <ConversationList
              selectedId={selectedConversation}
              onSelect={setSelectedConversation}
              onNewChat={() => setNewChatOpen(true)}
              onSignOut={handleSignOut}
              refreshKey={refreshKey}
              isOnline={isOnline}
              onGlobalSearch={() => setGlobalSearchOpen(true)}
              onCallHistory={() => setShowCallHistory(true)}
            />
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea conversationId={selectedConversation} isOnline={isOnline} onStartCall={handleStartCall} />
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
        {incomingCall && (
          <IncomingCallDialog call={incomingCall} onAnswer={answerCall} onDecline={declineCall} />
        )}
        {activeCall && (
          <ActiveCallOverlay
            call={activeCall}
            duration={callDuration}
            formatDuration={formatCallDuration}
            isMuted={callMuted}
            isVideoEnabled={isVideoEnabled}
            isSpeaker={isSpeaker}
            onEndCall={endCall}
            onToggleMute={toggleCallMute}
            onToggleVideo={toggleVideo}
            onToggleSpeaker={toggleSpeaker}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={toggleScreenShare}
            localStreamRef={localStreamRef}
            remoteStreamRef={remoteStreamRef}
          />
        )}
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
      {mobileInChat ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-2 py-1.5 border-b border-border/50 bg-card/95 backdrop-blur-md flex items-center gap-2 safe-area-top">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedConversation(null)}
              className="shrink-0 -ml-1 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatArea conversationId={selectedConversation} isOnline={isOnline} onStartCall={handleStartCall} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === "calls" ? (
              <CallHistory
                onSelectConversation={(id) => { setSelectedConversation(id); setMobileTab("chats"); }}
                onStartCall={handleStartCall}
              />
            ) : (
              <ConversationList
                selectedId={selectedConversation}
                onSelect={setSelectedConversation}
                onNewChat={() => setNewChatOpen(true)}
                onSignOut={handleSignOut}
                refreshKey={refreshKey}
                isOnline={isOnline}
              />
            )}
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
      {incomingCall && (
        <IncomingCallDialog call={incomingCall} onAnswer={answerCall} onDecline={declineCall} />
      )}
      {activeCall && (
        <ActiveCallOverlay
          call={activeCall}
          duration={callDuration}
          formatDuration={formatCallDuration}
          isMuted={callMuted}
          isVideoEnabled={isVideoEnabled}
          isSpeaker={isSpeaker}
          onEndCall={endCall}
          onToggleMute={toggleCallMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={toggleSpeaker}
          isScreenSharing={isScreenSharing}
          onToggleScreenShare={toggleScreenShare}
          localStreamRef={localStreamRef}
          remoteStreamRef={remoteStreamRef}
        />
      )}
    </div>
  );
};

export default Chat;
