import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { formatDateDivider, toDate } from '../../utils/formatting';
import { EmptyState } from '../common/EmptyState';
import { MessageSquare, Sparkles } from 'lucide-react';

export function MessageList({
  messages,
  currentUserId,
  targetUser,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone
}) {
  const containerRef = useRef(null);

  // Filter out messages that the current user chose to "Delete for me"
  const visibleMessages = messages.filter(
    (msg) => !msg.deletedFor || !msg.deletedFor.includes(currentUserId)
  );

  // Auto scroll within container ONLY (never triggers window/body scroll jumps)
  const scrollToBottom = (behavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    // Immediate scroll on first load, smooth on subsequent messages
    scrollToBottom(visibleMessages.length > 20 ? 'auto' : 'smooth');
  }, [visibleMessages.length]);

  if (visibleMessages.length === 0) {
    const targetName = targetUser?.displayName || targetUser?.username || 'this user';
    return (
      <div ref={containerRef} className="message-list-container">
        <EmptyState
          icon={Sparkles}
          title="Say Hello!"
          description={`Start your conversation with ${targetName}. Send a greeting to connect.`}
        />
      </div>
    );
  }

  // Group messages by date
  let lastDateString = '';

  return (
    <div ref={containerRef} className="message-list-container" role="log" aria-live="polite">
      {visibleMessages.map((message) => {
        const msgDate = toDate(message.createdAt);
        const dateString = msgDate ? msgDate.toDateString() : '';
        const showDateDivider = dateString && dateString !== lastDateString;
        if (showDateDivider) {
          lastDateString = dateString;
        }

        const isCurrentUser = message.senderId === currentUserId;

        return (
          <React.Fragment key={message.id}>
            {showDateDivider && (
              <div className="message-date-divider">
                <span className="message-date-label">
                  {formatDateDivider(message.createdAt)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isCurrentUser={isCurrentUser}
              currentUserId={currentUserId}
              onReact={onReact}
              onDeleteForMe={onDeleteForMe}
              onDeleteForEveryone={onDeleteForEveryone}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
