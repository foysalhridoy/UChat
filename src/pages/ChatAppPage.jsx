import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Settings,
  Sun,
  Moon,
  MessageSquarePlus,
  MessageSquare,
  LogOut,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { useTyping } from '../hooks/useTyping';
import { Avatar } from '../components/common/Avatar';
import { EmptyState } from '../components/common/EmptyState';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { MessageComposer } from '../components/chat/MessageComposer';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { UserSearchModal } from '../components/chat/UserSearchModal';
import { ProfileSettingsModal } from '../components/settings/ProfileSettingsModal';
import { Modal } from '../components/common/Modal';
import { IncomingCallModal } from '../components/call/IncomingCallModal';
import { ActiveCallModal } from '../components/call/ActiveCallModal';
import {
  initiateCall,
  answerCall,
  rejectIncomingCall,
  subscribeToIncomingCalls,
  stopRingtone
} from '../services/callService';
import { getOrCreateConversation } from '../services/conversationService';
import {
  sendMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  toggleMessageReaction
} from '../services/messageService';
import { formatLastSeen } from '../utils/formatting';
import { subscribeUserProfile, getUserProfile } from '../services/userService';

export function ChatAppPage() {
  const { currentUser, userProfile, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { showToast } = useToast();

  // Active state
  const [activeConversation, setActiveConversation] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // Real-time conversations for current user
  const { conversations, loading: convsLoading } = useConversations(currentUser?.uid);

  // Synchronize active conversation with incoming real-time updates
  useEffect(() => {
    if (activeConversation) {
      const updated = conversations.find((c) => c.id === activeConversation.id);
      if (updated) {
        setActiveConversation(updated);
      }
    }
  }, [conversations]);

  // Active conversation details
  const activeConversationId = activeConversation?.id;
  const targetUid = activeConversation?.participants?.find((uid) => uid !== currentUser?.uid);
  const staticTargetUser = activeConversation?.participantData?.[targetUid];
  const [liveTargetUser, setLiveTargetUser] = useState(staticTargetUser || null);

  useEffect(() => {
    if (!targetUid) {
      setLiveTargetUser(null);
      return;
    }
    let isMounted = true;
    getUserProfile(targetUid).then((data) => {
      if (isMounted && data) {
        setLiveTargetUser((prev) => ({ ...prev, ...data }));
      }
    });
    const unsub = subscribeUserProfile(targetUid, (data) => {
      if (isMounted && data) {
        setLiveTargetUser((prev) => ({ ...prev, ...data }));
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [targetUid]);

  const targetUser = liveTargetUser || staticTargetUser;

  // Real-time messages for active chat
  const { messages, loading: msgsLoading } = useMessages(activeConversationId, currentUser?.uid);

  // Real-time typing indicators
  const { handleUserTyping, stopTyping } = useTyping(activeConversationId, currentUser?.uid);

  // Check if target user is currently typing
  const isTargetTyping = Boolean(
    activeConversation?.typing &&
    targetUid &&
    activeConversation.typing[targetUid]
  );

  // Select conversation handler
  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setMobileView('chat');
  };

  // Back to conversations on mobile
  const handleBackToList = () => {
    setMobileView('list');
  };

  // WebRTC Audio & Video Calling State
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callLocalStream, setCallLocalStream] = useState(null);
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('calling'); // 'calling' | 'connecting' | 'connected'
  const callSessionRef = React.useRef(null);

  // Subscribe to incoming calls for current user
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToIncomingCalls(currentUser.uid, (call) => {
      if (call) {
        if (!activeCall) {
          setIncomingCall(call);
        }
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsub();
  }, [currentUser?.uid, activeCall]);

  const cleanupCallUI = () => {
    stopRingtone();
    callSessionRef.current = null;
    setActiveCall(null);
    setCallLocalStream(null);
    setCallRemoteStream(null);
    setCallStatus('calling');
  };

  const handleStartCall = async (target, type = 'audio') => {
    if (!currentUser || !target) return;
    if (activeCall) {
      showToast('You are already in a call', 'warning');
      return;
    }

    try {
      const otherUid = target.uid || target.id;
      const otherName = target.displayName || target.username || 'User';
      const otherPhoto = target.photoURL || '';

      setActiveCall({
        type,
        otherUserName: otherName,
        otherUserPhoto: otherPhoto,
        isCaller: true
      });
      setCallStatus('calling');

      const session = await initiateCall({
        caller: userProfile || currentUser,
        receiver: { uid: otherUid, displayName: otherName, photoURL: otherPhoto },
        type,
        onRemoteStream: (stream) => {
          setCallRemoteStream(stream);
          setCallStatus('connected');
        },
        onCallActive: () => {
          setCallStatus('connected');
        },
        onCallRejected: () => {
          showToast(`${otherName} declined the call`, 'info');
          cleanupCallUI();
        },
        onCallEnded: () => {
          showToast('Call ended', 'info');
          cleanupCallUI();
        }
      });

      callSessionRef.current = session;
      setCallLocalStream(session.localStream);
    } catch (err) {
      console.error('Failed to initiate call:', err);
      showToast('Could not access microphone/camera. Please check permissions.', 'error');
      cleanupCallUI();
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    const callToAnswer = incomingCall;
    setIncomingCall(null);

    try {
      setActiveCall({
        callId: callToAnswer.id,
        type: callToAnswer.type,
        otherUserName: callToAnswer.callerName,
        otherUserPhoto: callToAnswer.callerPhoto,
        isCaller: false
      });
      setCallStatus('connecting');

      const session = await answerCall({
        call: { ...callToAnswer, callId: callToAnswer.id },
        onRemoteStream: (stream) => {
          setCallRemoteStream(stream);
          setCallStatus('connected');
        },
        onCallEnded: () => {
          showToast('Call ended', 'info');
          cleanupCallUI();
        }
      });

      callSessionRef.current = session;
      setCallLocalStream(session.localStream);
    } catch (err) {
      console.error('Failed to answer call:', err);
      showToast('Could not access microphone/camera to answer call.', 'error');
      cleanupCallUI();
    }
  };

  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    const id = incomingCall.id;
    setIncomingCall(null);
    await rejectIncomingCall(id);
  };

  const handleEndActiveCall = async () => {
    if (callSessionRef.current?.endCall) {
      await callSessionRef.current.endCall();
    }
    cleanupCallUI();
  };

  // Start new conversation from search modal
  const handleStartConversation = async (targetUserItem) => {
    try {
      const conv = await getOrCreateConversation(
        userProfile || currentUser,
        targetUserItem
      );
      setActiveConversation(conv);
      setMobileView('chat');
    } catch (err) {
      console.error('Error starting conversation:', err);
      showToast(err.message || 'Could not start conversation', 'error');
    }
  };

  // Send message handler
  const handleSendMessage = async (text) => {
    if (!activeConversationId || !currentUser?.uid || !targetUid) return;
    try {
      stopTyping();
      await sendMessage(activeConversationId, currentUser.uid, targetUid, text);
    } catch (err) {
      console.error('Error sending message:', err);
      showToast('Failed to send message. Please check connection.', 'error');
      throw err;
    }
  };


  // Message reaction handler
  const handleReact = async (messageId, emoji) => {
    if (!activeConversationId || !currentUser?.uid) return;
    try {
      await toggleMessageReaction(activeConversationId, messageId, currentUser.uid, emoji);
    } catch (err) {
      console.error('Error reacting to message:', err);
      showToast('Could not update reaction', 'error');
    }
  };

  // Delete for me handler
  const handleDeleteForMe = async (messageId) => {
    if (!activeConversationId || !currentUser?.uid) return;
    try {
      await deleteMessageForMe(activeConversationId, messageId, currentUser.uid);
      showToast('Message removed for you', 'info');
    } catch (err) {
      console.error('Error deleting message for me:', err);
      showToast('Could not delete message', 'error');
    }
  };

  // Delete for everyone handler
  const handleDeleteForEveryone = async (messageId) => {
    if (!activeConversationId || !currentUser?.uid) return;
    try {
      await deleteMessageForEveryone(activeConversationId, messageId, currentUser.uid);
      showToast('Message deleted for everyone', 'info');
    } catch (err) {
      console.error('Error deleting message for everyone:', err);
      showToast('Could not delete message', 'error');
    }
  };

  return (
    <div className="app-container">
      <div className="chat-layout" data-view={mobileView}>
        {/* Sidebar: Conversation List */}
        <aside className="chat-sidebar" aria-label="Chats sidebar">
          {/* Header */}
          <div className="sidebar-header">
            <div
              className="sidebar-user-info"
              onClick={() => setIsSettingsOpen(true)}
              title="Edit profile & settings"
              role="button"
              tabIndex={0}
            >
              <Avatar
                src={userProfile?.photoURL}
                name={userProfile?.displayName || userProfile?.username}
                size="md"
                status="online"
                showStatus={true}
              />
              <div className="sidebar-user-details">
                <span className="sidebar-username">
                  {userProfile?.displayName || userProfile?.username || 'User'}
                </span>
                <span className="sidebar-user-tag">
                  @{userProfile?.username || 'username'}
                </span>
              </div>
            </div>

            <div className="sidebar-actions">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="btn btn-ghost btn-icon"
                title="Find users"
                aria-label="Find users"
              >
                <UserPlus size={19} />
              </button>

              <button
                onClick={toggleTheme}
                className="btn btn-ghost btn-icon"
                title="Toggle light/dark theme"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun size={19} /> : <Moon size={19} />}
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="btn btn-ghost btn-icon"
                title="Settings"
                aria-label="Settings"
              >
                <Settings size={19} />
              </button>
            </div>
          </div>

          {/* Quick Search filter */}
          <div className="sidebar-search-container">
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search conversations..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Conversation List */}
          <ConversationList
            conversations={conversations}
            currentUserId={currentUser?.uid}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            searchQuery={searchFilter}
            loading={convsLoading}
            onOpenSearch={() => setIsSearchOpen(true)}
          />

          {/* WhatsApp Style Mobile Floating Action Button (FAB) */}
          {mobileView === 'list' && (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="mobile-chat-fab"
              aria-label="Start new chat"
              title="Start new chat"
            >
              <MessageSquarePlus size={26} />
            </button>
          )}

          {/* Creator Attribution in Sidebar Bottom */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              flexShrink: 0
            }}
          >
            <span>UChat v1.0</span>
            <a
              href="https://github.com/foysalhridoy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary)',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Developed by Hridoy
            </a>
          </div>
        </aside>

        <main className="chat-main" aria-label="Chat messages area">
          {activeConversation ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
              <ChatHeader
                targetUser={targetUser}
                targetUserId={targetUid}
                onBack={handleBackToList}
                onViewProfile={(u) => setViewingUser(u || targetUser)}
                onStartCall={handleStartCall}
              />

              <MessageList
                messages={messages}
                currentUserId={currentUser?.uid}
                targetUser={targetUser}
                onReact={handleReact}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForEveryone={handleDeleteForEveryone}
              />

              {isTargetTyping && (
                <TypingIndicator
                  name={targetUser?.displayName || targetUser?.username}
                />
              )}

              <MessageComposer
                onSendMessage={handleSendMessage}
                onTyping={handleUserTyping}
                placeholder={`Message ${targetUser?.displayName || targetUser?.username || ''}...`}
              />
            </div>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No Conversation Selected"
              description="Choose a conversation from the sidebar or find a new friend to start chatting in real time."
              action={
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="btn btn-primary"
                  style={{ marginTop: 8 }}
                >
                  <UserPlus size={18} />
                  <span>Find People</span>
                </button>
              }
            />
          )}
        </main>
      </div>

      {/* User Search Modal */}
      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentUser={currentUser}
        onStartConversation={handleStartConversation}
      />

      {/* Profile & Settings Modal */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Target User Details Modal */}
      <Modal
        isOpen={Boolean(viewingUser)}
        onClose={() => setViewingUser(null)}
        title="User Profile"
        maxWidth={380}
      >
        {viewingUser && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <Avatar
              src={viewingUser.photoURL}
              name={viewingUser.displayName || viewingUser.username}
              size="xl"
              status={viewingUser.status}
              showStatus={true}
            />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {viewingUser.displayName || viewingUser.username}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                @{viewingUser.username}
              </p>
            </div>

            <div
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>Status</span>
              <span style={{ fontWeight: 600, color: viewingUser.status === 'online' ? 'var(--online)' : 'var(--text-muted)' }}>
                {formatLastSeen(viewingUser.status, viewingUser.lastSeen)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* WebRTC Incoming Call Alert Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* WebRTC Active Call Screen Modal */}
      {activeCall && (
        <ActiveCallModal
          call={activeCall}
          localStream={callLocalStream}
          remoteStream={callRemoteStream}
          callStatus={callStatus}
          onEndCall={handleEndActiveCall}
        />
      )}
    </div>
  );
}
