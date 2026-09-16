import React from 'react';

export function TypingIndicator({ name }) {
  if (!name) return null;

  return (
    <div className="typing-indicator-bar" aria-live="polite">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span>{name} is typing...</span>
    </div>
  );
}
