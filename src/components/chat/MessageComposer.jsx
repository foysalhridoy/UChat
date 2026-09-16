import React, { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Smile, Image as ImageIcon, X } from 'lucide-react';

const COMMON_EMOJIS = ['😊', '👍', '❤️', '🔥', '😂', '🎉', '👋', '✨'];

export function MessageComposer({
  onSendMessage,
  onSendImage,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...'
}) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl, name }
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [text]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({
      file,
      previewUrl,
      name: file.name
    });
    e.target.value = '';
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleClearImage = () => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setSelectedImage(null);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !selectedImage) || sending || disabled) return;

    try {
      setSending(true);
      setShowEmojiPicker(false);

      if (selectedImage && onSendImage) {
        await onSendImage(selectedImage.file, trimmed);
        handleClearImage();
      } else if (trimmed && onSendMessage) {
        await onSendMessage(trimmed);
      }

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

  const canSend = (text.trim().length > 0 || selectedImage !== null) && !sending && !disabled;

  return (
    <div className="message-composer-wrapper">
      {/* Hidden file input for photos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Selected Image Thumbnail Preview Tray */}
      {selectedImage && (
        <div className="composer-image-preview">
          <div className="composer-image-thumb-wrapper">
            <img
              src={selectedImage.previewUrl}
              alt="Preview"
              className="composer-image-thumb"
            />
            <button
              type="button"
              className="composer-image-remove-btn"
              onClick={handleClearImage}
              title="Remove photo"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </div>
          <span className="composer-image-name">{selectedImage.name}</span>
        </div>
      )}

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
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '3px 4px 3px 0',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Add emoji"
            aria-label="Add emoji"
          >
            <Smile size={18} />
          </button>

          {/* Photo / Image Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: selectedImage ? 'var(--primary)' : 'var(--text-muted)',
              padding: '3px 6px 3px 2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Send photo"
            aria-label="Attach photo"
          >
            <ImageIcon size={18} />
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
            placeholder={selectedImage ? 'Add a caption...' : placeholder}
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
