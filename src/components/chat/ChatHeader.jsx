import React, { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Video, Info } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { subscribeUserProfile, getUserProfile } from '../../services/userService';
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

  // Re-sync whenever targetUser or targetUserId changes
  useEffect(() => {
    if (targetUser) {
      setLiveUser(targetUser);
    }
  }, [targetUser, targetUserId]);

  // Subscribe to target user's real-time presence/profile
  useEffect(() => {
    if (!targetUserId) return;

    // Fetch immediately to ensure name is never missing
    getUserProfile(targetUserId).then((data) => {
      if (data) {
        setLiveUser(data);
      }
    });

    const unsubscribe = subscribeUserProfile(targetUserId, (userData) => {
      if (userData) {
        setLiveUser(userData);
      }
    });
    return () => unsubscribe();
  }, [targetUserId]);

  const displayName = liveUser?.displayName || liveUser?.username || targetUser?.displayName || targetUser?.username || 'User';
  const status = liveUser?.status || targetUser?.status || 'offline';
  const lastSeen = liveUser?.lastSeen || targetUser?.lastSeen;
  const statusText = formatLastSeen(status, lastSeen);

  const handleCallMock = (type) => {
    showToast(`${type} calling will be enabled in the upcoming WebRTC release!`, 'info');
  };

  return (
    <header className="chat-header">
      {/* Mobile Back Button with comfortable touch target */}
      <button
        onClick={onBack}
        className="btn btn-ghost btn-icon chat-back-btn"
        aria-label="Back to conversations"
        title="Back to conversations"
      >
        <ArrowLeft size={22} />
      </button>

      {/* Tappable Contact Area (Telegram / WhatsApp style) */}
      <div
        className="chat-header-user"
        onClick={() => onViewProfile && onViewProfile(liveUser || targetUser)}
        role="button"
        tabIndex={0}
        title="View profile info"
      >
        <Avatar
          src={liveUser?.photoURL || targetUser?.photoURL}
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

      {/* Header Actions */}
      <div className="chat-header-actions">
        <button
          onClick={() => handleCallMock('Voice')}
          className="btn btn-ghost btn-icon call-btn"
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>

        <button
          onClick={() => handleCallMock('Video')}
          className="btn btn-ghost btn-icon call-btn"
          title="Video call"
          aria-label="Video call"
        >
          <Video size={19} />
        </button>

        <button
          onClick={() => onViewProfile && onViewProfile(liveUser || targetUser)}
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
