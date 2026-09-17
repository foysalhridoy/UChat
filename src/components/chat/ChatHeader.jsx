import React, { useEffect, useState } from 'react';
import { ArrowLeft, Phone, Video, Info, Users } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { subscribeUserProfile, getUserProfile } from '../../services/userService';
import { formatLastSeen } from '../../utils/formatting';
import { useToast } from '../../context/ToastContext';
import { unlockAudio } from '../../services/callService';

export function ChatHeader({
  targetUser,
  targetUserId,
  conversation,
  onBack,
  onViewProfile,
  onStartCall,
  onOpenGroupInfo
}) {
  const isGroup = conversation?.isGroup === true;
  const [liveUser, setLiveUser] = useState(targetUser || null);
  const { showToast } = useToast();

  // Re-sync basic static metadata only when the active chat user changes (1-to-1 only)
  useEffect(() => {
    if (!isGroup && targetUser) {
      setLiveUser((prev) => {
        if (!prev) return targetUser;
        return {
          ...targetUser,
          ...prev,
          displayName: prev.displayName || targetUser.displayName,
          username: prev.username || targetUser.username,
          photoURL: prev.photoURL || targetUser.photoURL,
          status: prev.status || targetUser.status || 'offline',
          lastSeen: prev.lastSeen || targetUser.lastSeen
        };
      });
    }
  }, [targetUserId, isGroup]);

  // Subscribe to target user's real-time presence/profile (1-to-1 only)
  useEffect(() => {
    if (isGroup || !targetUserId) return;
    let isMounted = true;
    getUserProfile(targetUserId).then((data) => {
      if (isMounted && data) setLiveUser((prev) => ({ ...prev, ...data }));
    });
    const unsubscribe = subscribeUserProfile(targetUserId, (userData) => {
      if (isMounted && userData) setLiveUser((prev) => ({ ...prev, ...userData }));
    });
    return () => { isMounted = false; unsubscribe(); };
  }, [targetUserId, isGroup]);

  // ── Group info ──
  const groupName = conversation?.groupName || 'Group';
  const activeMembersCount = isGroup
    ? (conversation?.participants || []).filter(uid => conversation?.participantMap?.[uid] !== false).length
    : 0;

  // ── 1-to-1 info ──
  const displayName = liveUser?.displayName || liveUser?.username || targetUser?.displayName || targetUser?.username || 'User';
  const status = liveUser?.status || targetUser?.status || 'offline';
  const lastSeen = liveUser?.lastSeen || targetUser?.lastSeen;
  const statusText = formatLastSeen(status, lastSeen);

  return (
    <header className="chat-header">
      {/* Mobile Back Button */}
      <button
        onClick={onBack}
        className="btn btn-ghost btn-icon chat-back-btn"
        aria-label="Back to conversations"
        title="Back to conversations"
      >
        <ArrowLeft size={22} />
      </button>

      {/* Contact / Group Area */}
      <div
        className="chat-header-user"
        onClick={() => isGroup ? onOpenGroupInfo && onOpenGroupInfo() : onViewProfile && onViewProfile(liveUser || targetUser)}
        role="button"
        tabIndex={0}
        title={isGroup ? 'Group info' : 'View profile info'}
      >
        {/* Avatar */}
        {isGroup ? (
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), #7DA0CA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 700, color: '#fff'
          }}>
            {groupName[0]?.toUpperCase() || <Users size={18} />}
          </div>
        ) : (
          <Avatar
            src={liveUser?.photoURL || targetUser?.photoURL}
            name={displayName}
            size="md"
            status={status}
            showStatus={true}
          />
        )}

        <div className="chat-header-meta">
          <h2 className="chat-header-title">{isGroup ? groupName : displayName}</h2>
          <span className={`chat-header-status ${!isGroup && status === 'online' ? 'online' : ''}`}>
            {isGroup
              ? `${activeMembersCount} members`
              : statusText}
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="chat-header-actions">
        <button
          onClick={() => {
            unlockAudio();
            if (isGroup) {
              onStartCall && onStartCall(conversation, 'audio');
            } else {
              const targetUserObj = { ...(targetUser || {}), ...(liveUser || {}), uid: targetUserId, id: targetUserId };
              onStartCall && onStartCall(targetUserObj, 'audio');
            }
          }}
          className="btn btn-ghost btn-icon call-btn"
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>

        <button
          onClick={() => {
            unlockAudio();
            if (isGroup) {
              onStartCall && onStartCall(conversation, 'video');
            } else {
              const targetUserObj = { ...(targetUser || {}), ...(liveUser || {}), uid: targetUserId, id: targetUserId };
              onStartCall && onStartCall(targetUserObj, 'video');
            }
          }}
          className="btn btn-ghost btn-icon call-btn"
          title="Video call"
          aria-label="Video call"
        >
          <Video size={19} />
        </button>

        <button
          onClick={() => isGroup ? onOpenGroupInfo && onOpenGroupInfo() : onViewProfile && onViewProfile(liveUser || targetUser)}
          className="btn btn-ghost btn-icon"
          title={isGroup ? 'Group info' : 'Contact info'}
          aria-label={isGroup ? 'Group info' : 'Contact info'}
        >
          {isGroup ? <Users size={19} /> : <Info size={19} />}
        </button>
      </div>
    </header>
  );
}

