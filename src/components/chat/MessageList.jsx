import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { formatDateDivider, toDate } from '../../utils/formatting';
import { EmptyState } from '../common/EmptyState';
import { MessageSquare, Sparkles } from 'lucide-react';

export function MessageList({ messages, currentUserId, targetUser }) {
  const bottomRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    // Immediate scroll on first load, smooth on subsequent messages
    scrollToBottom(messages.length > 20 ? 'auto' : 'smooth');
  }, [messages]);

  if (messages.length === 0) {
    const targetName = targetUser?.displayName || targetUser?.username || 'this user';
    return (
      <div className="message-list-container">
        <EmptyState
          icon={Sparkles}
          title="Say Hello!"
          description={`Start your conversation with ${targetName}. Send a greeting to connect.`}
        />
        <div ref={bottomRef} />
      </div>
    );
  }

  // Group messages by date
  let lastDateString = '';

  return (
    <div className="message-list-container" role="log" aria-live="polite">
      {messages.map((message) => {
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
            />
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}
