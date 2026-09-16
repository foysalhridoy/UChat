import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { formatMessageTime } from '../../utils/formatting';

export function MessageBubble({ message, isCurrentUser }) {
  const timeFormatted = formatMessageTime(message.createdAt);

  return (
    <div className={`message-row ${isCurrentUser ? 'outgoing' : 'incoming'}`}>
      <div className="message-bubble">
        <span>{message.text}</span>
        <div className="message-meta">
          <span>{timeFormatted}</span>
          {isCurrentUser && (
            <span className="seen-icon" title={message.seen ? 'Seen' : 'Sent'}>
              {message.seen ? (
                <CheckCheck size={14} color="#a5b4fc" />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
