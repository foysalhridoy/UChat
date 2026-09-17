import React, { useState, useEffect } from 'react';
import { Search, Users, X, Check, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { searchUsers } from '../../services/userService';
import { createGroupConversation } from '../../services/groupService';
import { useToast } from '../../context/ToastContext';

export function CreateGroupModal({ isOpen, onClose, currentUser, onGroupCreated }) {
  const [step, setStep] = useState('name'); // 'name' | 'members'
  const [groupName, setGroupName] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('name');
      setGroupName('');
      setQuery('');
      setSearchResults([]);
      setSelectedMembers([]);
      setCreating(false);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const users = await searchUsers(trimmed, currentUser?.uid);
        setSearchResults(users);
      } catch {
        showToast('Search failed', 'error');
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, currentUser?.uid]);

  const toggleMember = (user) => {
    const uid = user.uid || user.id;
    setSelectedMembers((prev) =>
      prev.find((m) => (m.uid || m.id) === uid)
        ? prev.filter((m) => (m.uid || m.id) !== uid)
        : [...prev, user]
    );
  };

  const isSelected = (user) => {
    const uid = user.uid || user.id;
    return selectedMembers.some((m) => (m.uid || m.id) === uid);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { showToast('Please enter a group name', 'warning'); return; }
    if (selectedMembers.length === 0) { showToast('Add at least one member', 'warning'); return; }
    setCreating(true);
    try {
      const creator = {
        uid: currentUser.uid,
        username: currentUser.username || currentUser.displayName,
        displayName: currentUser.displayName || currentUser.username,
        photoURL: currentUser.photoURL || ''
      };
      const group = await createGroupConversation(creator, selectedMembers, groupName.trim());
      showToast(`Group "${groupName}" created!`, 'success');
      onGroupCreated(group);
      onClose();
    } catch (err) {
      showToast(err.message || 'Could not create group', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Group"
      maxWidth={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Group Name Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Group Name
          </label>
          <div style={{ position: 'relative' }}>
            <Users size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 38, borderRadius: 'var(--radius-md)' }}
              placeholder="e.g. Friends, Study Group..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>
        </div>

        {/* Member Search */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Add Members {selectedMembers.length > 0 && `(${selectedMembers.length} selected)`}
          </label>
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              style={{ borderRadius: 'var(--radius-md)' }}
              placeholder="Search by username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Selected members chips */}
        {selectedMembers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {selectedMembers.map((m) => {
              const uid = m.uid || m.id;
              return (
                <div key={uid} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 6px', borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--primary-subtle)', border: '1px solid var(--primary)',
                  fontSize: '0.82rem', color: 'var(--primary-text)', fontWeight: 600
                }}>
                  <Avatar src={m.photoURL} name={m.displayName || m.username} size="xs" />
                  <span>{m.displayName || m.username}</span>
                  <button
                    onClick={() => toggleMember(m)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search Results */}
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {searchLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <Loader2 size={22} className="spinner" style={{ color: 'var(--primary)' }} />
            </div>
          )}
          {!searchLoading && searchResults.map((u) => {
            const selected = isSelected(u);
            return (
              <div
                key={u.uid || u.id}
                onClick={() => toggleMember(u)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  backgroundColor: selected ? 'var(--primary-subtle)' : 'var(--bg-tertiary)',
                  border: `1px solid ${selected ? 'var(--primary)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar src={u.photoURL} name={u.displayName || u.username} size="md" status={u.status} showStatus />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.displayName || u.username}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{u.username}</p>
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected ? 'var(--primary)' : 'var(--border-strong)'}`,
                  backgroundColor: selected ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
          {!searchLoading && !query && (
            <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              Search for users to add to the group.
            </div>
          )}
        </div>

        {/* Create Button */}
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selectedMembers.length === 0}
          style={{ width: '100%', marginTop: 4, minHeight: 42 }}
        >
          {creating
            ? <><Loader2 size={16} className="spinner" /> Creating...</>
            : <><Users size={16} /> Create Group ({selectedMembers.length + 1} members)</>
          }
        </button>

      </div>
    </Modal>
  );
}
