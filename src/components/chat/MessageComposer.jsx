import React, { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Smile } from 'lucide-react';

const COMMON_EMOJIS = ['😊', '👍', '❤️', '🔥', '😂', '🎉', '👋', '✨'];

export function MessageComposer({
  onSendMessage,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...'
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [text]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    try {
      setSending(true);
      setShowEmojiPicker(false);
      await onSendMessage(trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        if (!isTouch) {
          textareaRef.current.focus();
        }
      }
      if (typeof window !== 'undefined' && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      // Guarantee newly sent message is scrolled completely above the composer
      setTimeout(() => {
        const anchor = document.querySelector('.messages-bottom-anchor');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          const list = document.querySelector('.message-list-container');
          if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
      setTimeout(() => {
        const anchor = document.querySelector('.messages-bottom-anchor');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 180);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    if (onTyping) {
      onTyping();
    }
  };

  const canSend = text.trim().length > 0 && !sending && !disabled;

  return (
    <div className="message-composer-wrapper">
      {/* Quick emoji popover */}
      {showEmojiPicker && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '6px 10px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 8,
            boxShadow: 'var(--shadow-md)',
            overflowX: 'auto'
          }}
        >
          {COMMON_EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => addEmoji(emoji)}
              style={{
                fontSize: '1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form className="message-composer-form" onSubmit={handleSend}>
        <div className="composer-pill">
          {/* Emoji Picker Button */}
          <button
            type="button"
            className={`composer-emoji-btn ${showEmojiPicker ? 'active' : ''}`}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            title="Add emoji"
            aria-label="Add emoji"
          >
            <Smile size={21} strokeWidth={1.85} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                const el = document.querySelector('.message-list-container');
                if (el) el.scrollTop = el.scrollHeight;
                if (typeof window !== 'undefined' && window.scrollY !== 0) {
                  window.scrollTo(0, 0);
                }
              }, 250);
            }}
            placeholder={placeholder}
            className="composer-textarea"
            rows={1}
            disabled={disabled}
            aria-label="Message text"
          />
        </div>

        {/* WhatsApp/Telegram Floating Circular Send Button */}
        <button
          type="submit"
          disabled={!canSend}
          className="composer-send-btn"
          aria-label="Send message"
          title="Send message (Enter)"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          <SendHorizonal size={16} />
        </button>
      </form>
    </div>
  );
}
