import React, { useState } from 'react';
import { LogOut, Trash2, Crown, Users } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { leaveGroup, deleteGroup } from '../../services/groupService';
import { useToast } from '../../context/ToastContext';

export function GroupInfoModal({ isOpen, onClose, conversation, currentUserId, onGroupLeft }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  if (!conversation?.isGroup) return null;

  const isAdmin = conversation.admins?.includes(currentUserId);
  const isCreator = conversation.createdBy === currentUserId;

  const activeMembers = (conversation.participants || []).filter(
    (uid) => conversation.participantMap?.[uid] !== false
  );

  const handleLeave = async () => {
    if (!window.confirm('Leave this group?')) return;
    setLoading(true);
    try {
      await leaveGroup(conversation.id, currentUserId);
      showToast('You left the group', 'info');
      onGroupLeft && onGroupLeft(conversation.id);
      onClose();
    } catch (err) {
      showToast(err.message || 'Could not leave group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${conversation.groupName}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await deleteGroup(conversation.id, currentUserId);
      showToast('Group deleted', 'info');
      onGroupLeft && onGroupLeft(conversation.id);
      onClose();
    } catch (err) {
      showToast(err.message || 'Could not delete group', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Group Info" maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Group Avatar + Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), #7DA0CA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', color: '#fff', fontWeight: 700, flexShrink: 0
          }}>
            {conversation.groupName?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              {conversation.groupName}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {activeMembers.length} members
            </p>
          </div>
        </div>

        {/* Members List */}
        <div>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Members
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {activeMembers.map((uid) => {
              const member = conversation.participantData?.[uid];
              const memberIsAdmin = conversation.admins?.includes(uid);
              const memberIsCreator = conversation.createdBy === uid;
              return (
                <div key={uid} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  backgroundColor: uid === currentUserId ? 'var(--primary-subtle)' : 'var(--bg-tertiary)',
                  border: `1px solid ${uid === currentUserId ? 'var(--primary)' : 'transparent'}`
                }}>
                  <Avatar
                    src={member?.photoURL}
                    name={member?.displayName || member?.username || 'User'}
                    size="md"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member?.displayName || member?.username || 'User'}
                      {uid === currentUserId && ' (You)'}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{member?.username || 'user'}</p>
                  </div>
                  {memberIsCreator && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                      <Crown size={13} /> Admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={handleLeave}
            disabled={loading}
            style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)', border: '1px solid', justifyContent: 'center', gap: 8 }}
          >
            <LogOut size={16} />
            Leave Group
          </button>
          {isAdmin && (
            <button
              className="btn btn-ghost"
              onClick={handleDelete}
              disabled={loading}
              style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)', border: '1px solid', justifyContent: 'center', gap: 8 }}
            >
              <Trash2 size={16} />
              Delete Group
            </button>
          )}
        </div>

      </div>
    </Modal>
  );
}
