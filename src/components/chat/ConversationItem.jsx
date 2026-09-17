import React, { useState, useEffect } from 'react';
import { Avatar } from '../common/Avatar';
import { formatConversationTime } from '../../utils/formatting';
import { subscribeUserProfile, getUserProfile } from '../../services/userService';
import { Users } from 'lucide-react';

export function ConversationItem({
  conversation,
  currentUserId,
  isActive,
  onSelect
}) {
  const isGroup = conversation.isGroup === true;

  // ── 1-to-1: identify the other participant ──
  const otherUid = !isGroup
    ? conversation.participants?.find(uid => uid !== currentUserId)
    : null;
  const otherData = !isGroup
    ? (conversation.participantData?.[otherUid] || { displayName: 'User', username: 'user', photoURL: '' })
    : null;

  const [liveUser, setLiveUser] = useState(otherData);

  useEffect(() => {
    if (isGroup || !otherUid) return;
    let isMounted = true;
    getUserProfile(otherUid).then((profile) => {
      if (isMounted && profile) setLiveUser((prev) => ({ ...prev, ...profile }));
    });
    const unsub = subscribeUserProfile(otherUid, (profile) => {
      if (isMounted && profile) setLiveUser((prev) => ({ ...prev, ...profile }));
    });
    return () => { isMounted = false; unsub(); };
  }, [otherUid, isGroup]);

  const unreadCount = conversation.unreadCounts?.[currentUserId] || 0;

  // Typing indicator
  const isTyping = isGroup
    ? Object.entries(conversation.typing || {}).some(([uid, v]) => uid !== currentUserId && !!v)
    : Boolean(conversation.typing?.[otherUid]);

  const lastMsg = conversation.lastMessage;
  const lastTime = lastMsg?.createdAt || conversation.updatedAt;

  // Active members count for groups
  const activeMembersCount = isGroup
    ? (conversation.participants || []).filter(uid => conversation.participantMap?.[uid] !== false).length
    : null;

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      aria-selected={isActive}
    >
      {/* Avatar — group shows letter, DM shows user photo */}
      {isGroup ? (
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--primary), #7DA0CA)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', fontWeight: 700, color: '#fff', userSelect: 'none'
        }}>
          {conversation.groupName?.[0]?.toUpperCase() || <Users size={20} />}
        </div>
      ) : (
        <Avatar
          src={liveUser?.photoURL || otherData?.photoURL}
          name={liveUser?.displayName || liveUser?.username || otherData?.displayName}
          size="md"
          status={liveUser?.status || 'offline'}
          showStatus={true}
        />
      )}

      <div className="conversation-content">
        <div className="conversation-top">
          <span className="conversation-name">
            {isGroup
              ? conversation.groupName
              : (liveUser?.displayName || liveUser?.username || otherData?.displayName || otherData?.username)}
          </span>
          {lastTime && (
            <span className="conversation-time">{formatConversationTime(lastTime)}</span>
          )}
        </div>
        <div className="conversation-bottom">
          {isTyping ? (
            <span className="conversation-preview typing">Typing...</span>
          ) : (
            <span className={`conversation-preview ${unreadCount > 0 ? 'unread' : ''}`}>
              {lastMsg?.text ? (
                isGroup && lastMsg.senderId !== currentUserId
                  ? `${conversation.participantData?.[lastMsg.senderId]?.displayName?.split(' ')[0] || 'Someone'}: ${lastMsg.text}`
                  : lastMsg.senderId === currentUserId ? `You: ${lastMsg.text}` : lastMsg.text
              ) : isGroup ? (
                `Group · ${activeMembersCount} members`
              ) : (
                'Started a conversation'
              )}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="unread-badge" aria-label={`${unreadCount} unread messages`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

