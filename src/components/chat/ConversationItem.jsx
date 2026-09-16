import React from 'react';
import { Avatar } from '../common/Avatar';
import { formatConversationTime } from '../../utils/formatting';

export function ConversationItem({
  conversation,
  currentUserId,
  isActive,
  onSelect
}) {
  // Identify the other participant
  const otherUid = conversation.participants?.find(uid => uid !== currentUserId);
  const otherData = conversation.participantData?.[otherUid] || {
    displayName: 'User',
    username: 'user',
    photoURL: ''
  };

  const unreadCount = conversation.unreadCounts?.[currentUserId] || 0;

  // Check if other participant is currently typing
  const isOtherTyping = Boolean(
    conversation.typing &&
    conversation.typing[otherUid]
  );

  const lastMsg = conversation.lastMessage;
  const lastTime = lastMsg?.createdAt || conversation.updatedAt;

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-selected={isActive}
    >
      <Avatar
        src={otherData.photoURL}
        name={otherData.displayName || otherData.username}
        size="md"
        status={otherData.status}
        showStatus={true}
      />
      <div className="conversation-content">
        <div className="conversation-top">
          <span className="conversation-name">
            {otherData.displayName || otherData.username}
          </span>
          {lastTime && (
            <span className="conversation-time">
              {formatConversationTime(lastTime)}
            </span>
          )}
        </div>
        <div className="conversation-bottom">
          {isOtherTyping ? (
            <span className="conversation-preview typing">
              Typing...
            </span>
          ) : (
            <span className={`conversation-preview ${unreadCount > 0 ? 'unread' : ''}`}>
              {lastMsg?.text ? (
                lastMsg.senderId === currentUserId ? `You: ${lastMsg.text}` : lastMsg.text
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
