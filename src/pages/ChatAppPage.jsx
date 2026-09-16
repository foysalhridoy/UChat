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
import { getOrCreateConversation } from '../services/conversationService';
import { sendMessage } from '../services/messageService';
import { formatLastSeen } from '../utils/formatting';

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
  const targetUser = activeConversation?.participantData?.[targetUid];

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

        {/* Main Content Area: Active Chat or Empty Placeholder */}
        <main className="chat-main" aria-label="Chat messages area">
          {activeConversation ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
              <ChatHeader
                targetUser={targetUser}
                targetUserId={targetUid}
                onBack={handleBackToList}
                onViewProfile={(u) => setViewingUser(u || targetUser)}
              />

              <MessageList
                messages={messages}
                currentUserId={currentUser?.uid}
                targetUser={targetUser}
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
    </div>
  );
}
