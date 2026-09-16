import React, { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Info } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { subscribeUserProfile } from '../../services/userService';
import { formatLastSeen } from '../../utils/formatting';
import { useToast } from '../../context/ToastContext';

export function ChatHeader({
  targetUser,
  targetUserId,
  onBack,
  onViewProfile
}) {
  const [liveUser, setLiveUser] = useState(targetUser || null);
  const { showToast } = useToast();

  // Subscribe to target user's real-time presence/profile
  useEffect(() => {
    if (!targetUserId) return;
    const unsubscribe = subscribeUserProfile(targetUserId, (userData) => {
      if (userData) {
        setLiveUser(userData);
      }
    });
    return () => unsubscribe();
  }, [targetUserId]);

  const displayName = liveUser?.displayName || liveUser?.username || 'User';
  const status = liveUser?.status || 'offline';
  const statusText = formatLastSeen(status, liveUser?.lastSeen);

  const handleCallMock = (type) => {
    showToast(`${type} call feature is coming soon in the WebRTC update!`, 'info');
  };

  return (
    <header className="chat-header">
      {/* Mobile Back Button */}
      <button
        onClick={onBack}
        className="btn btn-ghost btn-icon chat-back-btn"
        aria-label="Back to chats"
        title="Back to chats"
      >
        <ArrowLeft size={22} />
      </button>

      {/* Tappable Contact Area (Telegram / WhatsApp style) */}
      <div
        className="chat-header-user"
        onClick={() => onViewProfile && onViewProfile(liveUser)}
        role="button"
        tabIndex={0}
        title="Click to view profile info"
      >
        <Avatar
          src={liveUser?.photoURL}
          name={displayName}
          size="md"
          status={status}
          showStatus={true}
        />

        <div className="chat-header-meta">
          <h2 className="chat-header-title">{displayName}</h2>
          <span className={`chat-header-status ${status === 'online' ? 'online' : ''}`}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Header Actions (WhatsApp / Messenger Style) */}
      <div className="chat-header-actions">
        <button
          onClick={() => handleCallMock('Voice')}
          className="btn btn-ghost btn-icon"
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>

        <button
          onClick={() => handleCallMock('Video')}
          className="btn btn-ghost btn-icon"
          title="Video call"
          aria-label="Video call"
        >
          <Video size={19} />
        </button>

        <button
          onClick={() => onViewProfile && onViewProfile(liveUser)}
          className="btn btn-ghost btn-icon"
          title="Contact info"
          aria-label="Contact info"
        >
          <Info size={19} />
        </button>
      </div>
    </header>
  );
}
