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
  Info,
  PhoneOff
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
import { NotificationBanner } from '../components/common/NotificationBanner';
import {
  initNotifications,
  showMessageNotification,
  showCallNotification,
  dismissCallNotification,
  stopTitleFlash
} from '../services/notificationService';
import {
  initiateCall,
  answerCall,
  rejectIncomingCall,
  subscribeToIncomingCalls,
  stopRingtone,
  unlockAudio
} from '../services/callService';
import { getOrCreateConversation, getConversationId } from '../services/conversationService';
import {
  sendMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  toggleMessageReaction,
  logCallMessage
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
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);
  const [callStatus, setCallStatus] = useState('calling'); // 'calling' | 'connecting' | 'connected'
  const [callError, setCallError] = useState(null);
  const callSessionRef = React.useRef(null);
  const callConnectedAtRef = React.useRef(null);

  // Initialize notification listeners
  useEffect(() => {
    initNotifications((data) => {
      if (data?.conversationId) {
        const targetConv = conversations.find((c) => c.id === data.conversationId);
        if (targetConv) {
          setActiveConversation(targetConv);
          setMobileView('chat');
        }
      }
    });
  }, [conversations]);

  // Real-time background message notification listener
  const prevConvsRef = React.useRef({});
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;

    conversations.forEach((conv) => {
      const lastMsg = conv.lastMessage;
      if (!lastMsg) return;

      const prevMsgId = prevConvsRef.current[conv.id];
      const isDifferentMsg = prevMsgId && prevMsgId !== (lastMsg.id || lastMsg.createdAt?.seconds || lastMsg.text);
      const isFromOtherUser = lastMsg.senderId && lastMsg.senderId !== currentUser?.uid;

      if (isDifferentMsg && isFromOtherUser) {
        const isNotActiveChat = !activeConversation || activeConversation.id !== conv.id;
        if (document.hidden || isNotActiveChat) {
          const targetUid = conv.participants?.find((uid) => uid !== currentUser?.uid);
          const senderInfo = conv.participantData?.[lastMsg.senderId] || conv.participantData?.[targetUid] || {};
          const senderName = conv.isGroup
            ? `${lastMsg.senderName || senderInfo.displayName || 'Member'} in ${conv.groupName || 'Group'}`
            : (lastMsg.senderName || senderInfo.displayName || senderInfo.username || 'User');
          const senderPhoto = senderInfo.photoURL || '';

          showMessageNotification({
            senderName,
            text: lastMsg.text,
            icon: senderPhoto,
            conversationId: conv.id,
            onClick: () => {
              setActiveConversation(conv);
              setMobileView('chat');
            }
          });
        }
      }

      prevConvsRef.current[conv.id] = lastMsg.id || lastMsg.createdAt?.seconds || lastMsg.text;
    });
  }, [conversations, currentUser?.uid, activeConversation]);

  // Subscribe to incoming calls for current user via conversations
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToIncomingCalls(currentUser.uid, (call) => {
      if (call) {
        if (!activeCall) {
          setIncomingCall(call);
          // Show system desktop/mobile notification even when minimized or browser in background!
          showCallNotification({
            callerName: call.callerName,
            callerPhoto: call.callerPhoto,
            isVideo: call.type === 'video',
            callId: call.id || call.callId,
            onAccept: () => {
              window.focus();
            },
            onDecline: () => {
              rejectIncomingCall(call.conversationId || call.id);
              dismissCallNotification(call.id || call.callId);
            }
          });
        }
      } else {
        setIncomingCall(null);
        dismissCallNotification();
      }
    });
    return () => unsub();
  }, [currentUser?.uid, activeCall]);

  const cleanupCallUI = () => {
    stopRingtone();
    dismissCallNotification();
    stopTitleFlash();
    callConnectedAtRef.current = null;
    callSessionRef.current = null;
    setActiveCall(null);
    setCallLocalStream(null);
    setCallRemoteStream(null);
    setRemoteStreamVersion(0);
    setCallStatus('calling');
  };

  const handleStartCall = async (target, type = 'audio') => {
    unlockAudio();
    const otherUid = target?.uid || target?.id || targetUid;
    if (!currentUser || !otherUid) {
      setCallError('Could not identify recipient for the call.');
      return;
    }
    if (currentUser.uid === otherUid) {
      setCallError('You cannot call yourself.');
      return;
    }
    if (activeCall) {
      setCallError('You are already in an active call.');
      return;
    }

    try {
      const otherName = target.displayName || target.username || targetUser?.displayName || targetUser?.username || 'User';
      const otherPhoto = target.photoURL || targetUser?.photoURL || '';
      const convId = activeConversationId || getConversationId(currentUser.uid, otherUid);

      callConnectedAtRef.current = null;
      setActiveCall({
        conversationId: convId,
        type,
        otherUserName: otherName,
        otherUserPhoto: otherPhoto,
        isCaller: true,
        callerId: currentUser.uid,
        receiverId: otherUid
      });
      setCallStatus('calling');

      const session = await initiateCall({
        conversationId: convId,
        caller: userProfile || currentUser,
        receiver: { uid: otherUid, displayName: otherName, photoURL: otherPhoto },
        type,
        onRemoteStream: (stream) => {
          setCallRemoteStream(stream);
          setRemoteStreamVersion((v) => v + 1);
          setCallStatus('connected');
          if (!callConnectedAtRef.current) {
            callConnectedAtRef.current = Date.now();
          }
        },
        onCallActive: () => {
          setCallStatus('connected');
          if (!callConnectedAtRef.current) {
            callConnectedAtRef.current = Date.now();
          }
        },
        onCallRejected: () => {
          cleanupCallUI();
          setCallError(`${otherName} was unable or declined to take the call.`);
          logCallMessage(convId, {
            callId: session.callId,
            callerId: currentUser.uid,
            receiverId: otherUid,
            type,
            status: 'declined',
            duration: 0
          });
        },
        onCallEnded: () => {
          const duration = callConnectedAtRef.current
            ? Math.round((Date.now() - callConnectedAtRef.current) / 1000)
            : 0;
          const status = callConnectedAtRef.current ? 'completed' : 'missed';
          logCallMessage(convId, {
            callId: session.callId,
            callerId: currentUser.uid,
            receiverId: otherUid,
            type,
            status,
            duration
          });
          cleanupCallUI();
        }
      });

      callSessionRef.current = session;
      setActiveCall((prev) => (prev ? { ...prev, callId: session.callId } : null));
      setCallLocalStream(session.localStream);
    } catch (err) {
      console.error('Failed to initiate call:', err);
      cleanupCallUI();
      if (err.message && err.message.includes('HTTPS_REQUIRED')) {
        setCallError('HTTPS Connection Required: Audio and Video calling requires a secure HTTPS connection. Please open your deployed Vercel link (https://...) in Google Chrome instead of http://.');
      } else if (err.message && err.message.includes('BROWSER_UNSUPPORTED')) {
        setCallError('Your browser does not support media capture. Please open the app in Google Chrome or Safari.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCallError('Microphone or Camera access is blocked. In your phone settings, go to Settings > Apps > Chrome > Permissions and set Microphone & Camera to "Allow".');
      } else if (err.name === 'NotFoundError') {
        setCallError('No microphone or camera device found on this phone/computer.');
      } else {
        setCallError(err.message || 'Could not start call. Please check device permissions and try again.');
      }
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    unlockAudio();
    const callToAnswer = incomingCall;
    setIncomingCall(null);
    dismissCallNotification(callToAnswer.id || callToAnswer.callId);
    stopTitleFlash();

    try {
      const convId = callToAnswer.conversationId || activeConversationId || getConversationId(currentUser.uid, callToAnswer.callerId);

      callConnectedAtRef.current = null;
      setActiveCall({
        conversationId: convId,
        callId: callToAnswer.id || callToAnswer.callId,
        type: callToAnswer.type,
        otherUserName: callToAnswer.callerName,
        otherUserPhoto: callToAnswer.callerPhoto,
        isCaller: false,
        callerId: callToAnswer.callerId,
        receiverId: currentUser.uid
      });
      setCallStatus('connecting');

      const session = await answerCall({
        conversationId: convId,
        call: { ...callToAnswer, conversationId: convId },
        onRemoteStream: (stream) => {
          setCallRemoteStream(stream);
          setRemoteStreamVersion((v) => v + 1);
          setCallStatus('connected');
          if (!callConnectedAtRef.current) {
            callConnectedAtRef.current = Date.now();
          }
        },
        onCallActive: () => {
          setCallStatus('connected');
          if (!callConnectedAtRef.current) {
            callConnectedAtRef.current = Date.now();
          }
        },
        onCallEnded: () => {
          const duration = callConnectedAtRef.current
            ? Math.round((Date.now() - callConnectedAtRef.current) / 1000)
            : 0;
          const status = callConnectedAtRef.current ? 'completed' : 'missed';
          logCallMessage(convId, {
            callId: session.callId || callToAnswer.callId || callToAnswer.id,
            callerId: callToAnswer.callerId,
            receiverId: currentUser.uid,
            type: callToAnswer.type,
            status,
            duration
          });
          cleanupCallUI();
        }
      });

      callSessionRef.current = session;
      setCallLocalStream(session.localStream);
    } catch (err) {
      console.error('Failed to answer call:', err);
      cleanupCallUI();
      if (err.message && err.message.includes('HTTPS_REQUIRED')) {
        setCallError('HTTPS Connection Required: Audio and Video calling requires a secure HTTPS connection. Please open your deployed Vercel link (https://...) in Google Chrome instead of http://.');
      } else if (err.message && err.message.includes('BROWSER_UNSUPPORTED')) {
        setCallError('Your browser does not support media capture. Please open the app in Google Chrome or Safari.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCallError('Microphone or Camera access is blocked. In your phone settings, go to Settings > Apps > Chrome > Permissions and set Microphone & Camera to "Allow".');
      } else {
        setCallError(err.message || 'Could not access microphone/camera to answer the call.');
      }
    }
  };

  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    const callToDecline = incomingCall;
    const convId = callToDecline.conversationId || callToDecline.id;
    setIncomingCall(null);
    dismissCallNotification(callToDecline.callId || callToDecline.id);
    stopTitleFlash();
    await rejectIncomingCall(convId);
    logCallMessage(convId, {
      callId: callToDecline.callId || callToDecline.id,
      callerId: callToDecline.callerId,
      receiverId: currentUser?.uid,
      type: callToDecline.type,
      status: 'declined',
      duration: 0
    });
  };

  const handleEndActiveCall = async () => {
    const duration = callConnectedAtRef.current
      ? Math.round((Date.now() - callConnectedAtRef.current) / 1000)
      : 0;
    const status = callConnectedAtRef.current ? 'completed' : (activeCall?.isCaller ? 'missed' : 'declined');

    if (activeCall && activeCall.conversationId) {
      logCallMessage(activeCall.conversationId, {
        callId: activeCall.callId,
        callerId: activeCall.callerId || (activeCall.isCaller ? currentUser?.uid : targetUid),
        receiverId: activeCall.receiverId || (activeCall.isCaller ? targetUid : currentUser?.uid),
        type: activeCall.type,
        status,
        duration
      });
    }

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

          {/* Background Notification Permission Prompt Banner */}
          <NotificationBanner />

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
                placeholder="Type a message..."
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

      {/* Call Notice / Error Modal */}
      {callError && (
        <Modal
          isOpen={Boolean(callError)}
          onClose={() => setCallError(null)}
          title="Call Notice"
          maxWidth={380}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '8px 0' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOff size={24} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              {callError}
            </p>
            <button
              onClick={() => setCallError(null)}
              className="btn btn-primary"
              style={{ minWidth: 120, marginTop: 4 }}
            >
              OK
            </button>
          </div>
        </Modal>
      )}

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
          key={activeCall.callId || activeCall.conversationId}
          call={activeCall}
          localStream={callLocalStream}
          remoteStream={callRemoteStream}
          streamVersion={remoteStreamVersion}
          callStatus={callStatus}
          onEndCall={handleEndActiveCall}
        />
      )}
    </div>
  );
}
