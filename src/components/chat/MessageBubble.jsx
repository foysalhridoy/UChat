import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { formatMessageTime } from '../../utils/formatting';

export function MessageBubble({ message, isCurrentUser }) {
  const timeFormatted = formatMessageTime(message.createdAt);

  return (
    <div className={`message-row ${isCurrentUser ? 'outgoing' : 'incoming'}`}>
      <div className="message-bubble">
        <span className="message-text">{message.text}</span>
        <span className="message-meta">
          <span>{timeFormatted}</span>
          {isCurrentUser && (
            <span className="seen-icon" title={message.seen ? 'Seen' : 'Sent'}>
              {message.seen ? (
                <CheckCheck size={14} color="#93c5fd" />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
