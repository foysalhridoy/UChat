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
  onViewProfile,
  onStartCall
}) {
  const [liveUser, setLiveUser] = useState(targetUser || null);
  const { showToast } = useToast();

  // Re-sync basic static metadata only when the active chat user changes
  useEffect(() => {
    if (targetUser) {
      setLiveUser((prev) => {
        if (!prev) return targetUser;
        return {
          ...targetUser,
          ...prev, // Keep live properties from users/{id} subscription!
          displayName: prev.displayName || targetUser.displayName,
          username: prev.username || targetUser.username,
          photoURL: prev.photoURL || targetUser.photoURL,
          // CRITICAL: Strictly preserve real-time status and lastSeen from the user document
          status: prev.status || targetUser.status || 'offline',
          lastSeen: prev.lastSeen || targetUser.lastSeen
        };
      });
    }
  }, [targetUserId]);

  // Subscribe to target user's real-time presence/profile
  useEffect(() => {
    if (!targetUserId) return;

    let isMounted = true;

    // Fetch immediately to ensure name and online status are never missing
    getUserProfile(targetUserId).then((data) => {
      if (isMounted && data) {
        setLiveUser((prev) => ({ ...prev, ...data }));
      }
    });

    const unsubscribe = subscribeUserProfile(targetUserId, (userData) => {
      if (isMounted && userData) {
        setLiveUser((prev) => ({ ...prev, ...userData }));
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [targetUserId]);

  const displayName = liveUser?.displayName || liveUser?.username || targetUser?.displayName || targetUser?.username || 'User';
  // Use liveUser status as highest priority since it comes directly from users/{id}
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
          onClick={() => onStartCall && onStartCall(liveUser || targetUser, 'audio')}
          className="btn btn-ghost btn-icon call-btn"
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>

        <button
          onClick={() => onStartCall && onStartCall(liveUser || targetUser, 'video')}
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
