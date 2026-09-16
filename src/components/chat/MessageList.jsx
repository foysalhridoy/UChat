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
  const messagesEndRef = useRef(null);

  // Filter out messages that the current user chose to "Delete for me"
  const visibleMessages = messages.filter(
    (msg) => !msg.deletedFor || !msg.deletedFor.includes(currentUserId)
  );

  // Auto scroll within container ONLY (ensures last message is fully above typing box / keyboard)
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    } else if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    // Immediate scroll on first load, smooth on subsequent messages
    scrollToBottom(visibleMessages.length > 20 ? 'auto' : 'smooth');

    // Multi-tick scroll to account for layout reflow and virtual keyboard adjustments
    const t1 = setTimeout(() => scrollToBottom('smooth'), 60);
    const t2 = setTimeout(() => scrollToBottom('smooth'), 180);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visibleMessages.length]);

  // Keep message bottom in view if virtual keyboard resizes viewport
  useEffect(() => {
    const handleViewportResize = () => {
      scrollToBottom('auto');
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      return () => {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      };
    }
  }, []);

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
      {/* Bottom buffer anchor so last message is never cut off by composer/keyboard */}
      <div ref={messagesEndRef} className="messages-bottom-anchor" />
    </div>
  );
}
