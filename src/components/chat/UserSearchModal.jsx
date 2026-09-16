import React, { useState, useEffect } from 'react';
import { Search, UserPlus, MessageSquare, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { searchUsers } from '../../services/userService';
import { useToast } from '../../context/ToastContext';

export function UserSearchModal({
  isOpen,
  onClose,
  currentUser,
  onStartConversation
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const users = await searchUsers(trimmed, currentUser?.uid);
        setResults(users);
        setHasSearched(true);
      } catch (err) {
        console.error('Search error:', err);
        showToast('Failed to search users. Please try again.', 'error');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentUser?.uid, showToast]);

  const handleMessageUser = (user) => {
    onStartConversation(user);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Find People"
      maxWidth={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            style={{ borderRadius: 'var(--radius-md)' }}
            placeholder="Search by username or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ minHeight: 180, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spinner" style={{ color: 'var(--primary)' }} />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Avatar
                      src={u.photoURL}
                      name={u.displayName || u.username}
                      size="md"
                      status={u.status}
                      showStatus={true}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.94rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {u.displayName || u.username}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        @{u.username}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMessageUser(u)}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', minHeight: 34, fontSize: '0.82rem', flexShrink: 0 }}
                  >
                    <MessageSquare size={14} />
                    <span>Message</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>No users found</p>
              <p style={{ fontSize: '0.85rem' }}>No user matching "{query}" was found. Try another username.</p>
            </div>
          )}

          {!loading && !hasSearched && (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.88rem' }}>Type a username (e.g. "rahim") to find and connect with people anywhere.</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
