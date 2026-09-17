import React, { useState } from 'react';
import { LogOut, Moon, Sun, User, Check, RefreshCw } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zara',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sam'
];

export function ProfileSettingsModal({ isOpen, onClose }) {
  const { userProfile, updateProfileData, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [saving, setSaving] = useState(false);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen && userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhotoURL(userProfile.photoURL || '');
    }
  }, [isOpen, userProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast('Display name cannot be empty', 'error');
      return;
    }

    try {
      setSaving(true);
      await updateProfileData({
        displayName: displayName.trim(),
        photoURL
      });
      showToast('Profile updated successfully!', 'success');
      onClose();
    } catch (err) {
      console.error('Error updating profile:', err);
      showToast('Failed to update profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const generateRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    setPhotoURL(`https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile & Settings"
      maxWidth={480}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar Section */}
        <div className="settings-section">
          <label className="settings-section-title">Profile Picture</label>
          <div className="settings-avatar-wrapper">
            <Avatar
              src={photoURL}
              name={displayName || userProfile?.username}
              size="lg"
            />
            <div className="settings-avatar-actions">
              <button
                type="button"
                onClick={generateRandomAvatar}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', minHeight: 34, fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} />
                <span>Randomize Avatar</span>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose a style:</span>
            <div className="preset-avatars">
              {PRESET_AVATARS.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoURL(url)}
                  className={`preset-avatar-btn ${photoURL === url ? 'selected' : ''}`}
                >
                  <Avatar src={url} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="input-group">
          <label className="input-label" htmlFor="settings-name">Display Name</label>
          <input
            id="settings-name"
            type="text"
            className="input-field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
          />
        </div>

        {/* Read-only account info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group" style={{ margin: 0 }}>
            <span className="input-label">Username</span>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}
            >
              @{userProfile?.username || 'user'}
            </div>
          </div>

          <div className="input-group" style={{ margin: 0 }}>
            <span className="input-label">Account Type</span>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={userProfile?.email?.endsWith('@uchat.local') ? 'Direct Username Login' : userProfile?.email}
            >
              {userProfile?.email?.endsWith('@uchat.local') || userProfile?.isUsernameOnly
                ? 'Username Account'
                : userProfile?.email || 'Active'}
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="settings-section">
          <label className="settings-section-title">Preferences</label>
          <div className="theme-toggle-group">
            <div className="theme-toggle-label">
              {isDark ? <Moon size={18} color="#818cf8" /> : <Sun size={18} color="#f59e0b" />}
              <span>Dark Theme</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`btn ${isDark ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: 34, padding: '4px 14px', fontSize: '0.82rem' }}
            >
              {isDark ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Account actions */}
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={logout}
            className="btn btn-danger"
            style={{ width: '100%' }}
          >
            <LogOut size={16} />
            <span>Sign Out of UChat</span>
          </button>

          <a
            href="https://github.com/foysalhridoy"
            target="_blank"
            rel="noopener noreferrer"
            className="developer-badge"
            style={{ margin: '0 auto', fontSize: '0.82rem', padding: '6px 14px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <span>Developed by Hridoy</span>
          </a>
        </div>
      </form>
    </Modal>
  );
}
