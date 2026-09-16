import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Smile,
  Trash2,
  Ban,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video
} from 'lucide-react';
import { formatMessageTime, renderTextWithLinks } from '../../utils/formatting';
import { DeleteMessageModal } from './DeleteMessageModal';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export function MessageBubble({
  message,
  isCurrentUser,
  currentUserId,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const bubbleRef = useRef(null);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!showReactionPicker) return;
    const handleClickOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showReactionPicker]);

  const timeFormatted = formatMessageTime(message.createdAt);
  const isDeleted = Boolean(message.deletedForEveryone);

  // Reactions summary
  const reactionsMap = message.reactions || {};
  const reactionEntries = Object.entries(reactionsMap).filter(([_, users]) => users && users.length > 0);

  const handleSelectReaction = (emoji) => {
    setShowReactionPicker(false);
    if (onReact) {
      onReact(message.id, emoji);
    }
  };

  // Call message metadata
  const isCallMessage = message.type === 'call';
  const isVideoCall = message.callData?.type === 'video' || message.text?.toLowerCase().includes('video');
  const callStatus = message.callData?.status || (message.text?.toLowerCase().includes('missed') ? 'missed' : (message.text?.toLowerCase().includes('declined') ? 'declined' : 'completed'));
  const isCallMissed = callStatus === 'missed' || callStatus === 'declined' || callStatus === 'rejected';
  const duration = message.callData?.duration || 0;

  let callTitle = isVideoCall ? 'Video Call' : 'Voice Call';
  if (isCallMissed) {
    if (callStatus === 'declined' || callStatus === 'rejected') {
      callTitle = isCurrentUser ? (isVideoCall ? 'Declined Video Call' : 'Declined Voice Call') : (isVideoCall ? 'Declined Video Call' : 'Declined Voice Call');
    } else {
      callTitle = isCurrentUser ? (isVideoCall ? 'Unanswered Video Call' : 'Unanswered Voice Call') : (isVideoCall ? 'Missed Video Call' : 'Missed Voice Call');
    }
  } else {
    callTitle = isCurrentUser ? (isVideoCall ? 'Outgoing Video Call' : 'Outgoing Voice Call') : (isVideoCall ? 'Incoming Video Call' : 'Incoming Voice Call');
  }

  let callSubtitle = '';
  if (duration > 0) {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    callSubtitle = mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec`;
  } else if (callStatus === 'declined' || callStatus === 'rejected') {
    callSubtitle = 'Declined';
  } else if (isCallMissed) {
    callSubtitle = isCurrentUser ? 'No answer' : 'Missed';
  } else {
    callSubtitle = 'Call ended';
  }

  return (
    <>
      <div
        ref={bubbleRef}
        className={`message-row ${isCurrentUser ? 'outgoing' : 'incoming'} ${isDeleted ? 'deleted' : ''}`}
      >
        <div className="message-bubble-wrapper">
          {/* Action trigger buttons (visible on hover/focus) */}
          {!isDeleted && (
            <div className="message-actions-bar">
              <button
                type="button"
                className="message-action-btn"
                title="React"
                aria-label="React with emoji"
                onClick={() => setShowReactionPicker((prev) => !prev)}
              >
                <Smile size={15} />
              </button>
              <button
                type="button"
                className="message-action-btn delete-btn"
                title="Delete message"
                aria-label="Delete message"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {/* Floating Emoji Picker Popover */}
          {showReactionPicker && (
            <div className="message-reaction-picker">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="reaction-emoji-btn"
                  onClick={() => handleSelectReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Actual Message Bubble */}
          <div className="message-bubble">
            {isDeleted ? (
              <div className="message-deleted-content">
                <Ban size={15} className="deleted-icon" />
                <span className="deleted-text">
                  {isCurrentUser ? 'You deleted this message' : 'This message was deleted'}
                </span>
              </div>
            ) : isCallMessage ? (
              <div className={`message-call-card ${isCallMissed ? 'missed' : ''}`}>
                <div className={`message-call-icon ${isCallMissed ? 'missed' : ''}`}>
                  {isVideoCall ? (
                    <Video size={18} />
                  ) : isCallMissed ? (
                    <PhoneMissed size={18} />
                  ) : isCurrentUser ? (
                    <PhoneOutgoing size={18} />
                  ) : (
                    <PhoneIncoming size={18} />
                  )}
                </div>
                <div className="message-call-info">
                  <div className="message-call-title">
                    {callTitle}
                  </div>
                  <div className="message-call-subtitle">
                    {callSubtitle}
                  </div>
                </div>
              </div>
            ) : (
              <span className="message-text">
                {renderTextWithLinks(message.text)}
              </span>
            )}

            <span className="message-meta">
              <span>{timeFormatted}</span>
              {isCurrentUser && !isDeleted && (
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

          {/* Reaction Badges Tray on the bottom edge */}
          {!isDeleted && reactionEntries.length > 0 && (
            <div className="message-reactions-tray">
              {reactionEntries.map(([emoji, users]) => {
                const userHasReacted = users.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`reaction-badge ${userHasReacted ? 'active' : ''}`}
                    onClick={() => handleSelectReaction(emoji)}
                    title={userHasReacted ? `You reacted with ${emoji}` : `${users.length} reacted with ${emoji}`}
                  >
                    <span className="reaction-emoji">{emoji}</span>
                    {users.length > 1 && <span className="reaction-count">{users.length}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteMessageModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        isSender={isCurrentUser}
        onDeleteForMe={() => onDeleteForMe && onDeleteForMe(message.id)}
        onDeleteForEveryone={() => onDeleteForEveryone && onDeleteForEveryone(message.id)}
      />
    </>
  );
}
