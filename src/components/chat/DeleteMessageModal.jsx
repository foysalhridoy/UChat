import React from 'react';
import { Modal } from '../common/Modal';
import { Trash2, Users, User, AlertCircle } from 'lucide-react';

export function DeleteMessageModal({
  isOpen,
  onClose,
  isSender,
  onDeleteForMe,
  onDeleteForEveryone
}) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Message?"
      maxWidth="400px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.45 }}>
          {isSender
            ? 'You can delete this message for everyone in this chat or only for yourself.'
            : 'This message will be removed from your chat history. Other participants will still be able to see it.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {isSender && (
            <button
              onClick={() => {
                onDeleteForEveryone();
                onClose();
              }}
              className="btn btn-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 16px',
                fontWeight: 600
              }}
            >
              <Users size={18} />
              <span>Delete for everyone</span>
            </button>
          )}

          <button
            onClick={() => {
              onDeleteForMe();
              onClose();
            }}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 16px',
              fontWeight: 600,
              backgroundColor: 'var(--bg-tertiary)'
            }}
          >
            <User size={18} />
            <span>Delete for me</span>
          </button>

          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              padding: '10px 16px',
              fontWeight: 500,
              color: 'var(--text-muted)'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
