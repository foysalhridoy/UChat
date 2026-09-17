import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { registerUser, checkUsernameAvailability, getFriendlyErrorMessage } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { isFirebaseConfigured } from '../services/firebase';
import { isValidUsername, validatePassword } from '../utils/validation';

export function RegisterPage({ onNavigate }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Real-time username availability state
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking' | 'available' | 'taken' | 'invalid' | null
  const [statusMessage, setStatusMessage] = useState('');

  const { showToast } = useToast();

  // Debounced check for username availability
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus(null);
      setStatusMessage('');
      return;
    }

    if (!isValidUsername(clean)) {
      setUsernameStatus('invalid');
      setStatusMessage('3-20 letters, numbers, or underscores');
      return;
    }

    setUsernameStatus('checking');
    setStatusMessage('Checking availability...');

    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(clean);
        if (res.available) {
          setUsernameStatus('available');
          setStatusMessage('Username is available!');
        } else {
          setUsernameStatus('taken');
          setStatusMessage('Username is already taken');
        }
      } catch (err) {
        // If firestore rules block unauthenticated reads or offline, we will validate on submit
        setUsernameStatus(null);
        setStatusMessage('');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFirebaseConfigured) {
      setError('Firebase credentials are not configured yet. Please check the setup instructions.');
      return;
    }

    if (!isValidUsername(username)) {
      setError('Username must be 3-20 characters long and contain only letters, numbers, and underscores.');
      return;
    }

    if (usernameStatus === 'taken') {
      setError('This username is already taken. Please choose another username.');
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      setError(passCheck.message);
      return;
    }

    try {
      setLoading(true);
      await registerUser({
        password,
        username,
        displayName: displayName.trim() || username
      });
      showToast('Account created! Welcome to UChat.', 'success');
      onNavigate('chat');
    } catch (err) {
      console.error('Registration error:', err);
      const friendlyMsg = getFriendlyErrorMessage(err);
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('landing');
          }}
          className="auth-back-link"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </a>

        <div className="auth-header">
          <div className="auth-logo">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary), #818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              <MessageSquare size={24} />
            </div>
          </div>
          <h1 className="auth-title">Create an account</h1>
          <p className="auth-subtitle">Choose a unique username to get started</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" htmlFor="reg-username">Unique Username</label>
              {usernameStatus === 'checking' && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Loader2 size={12} className="spinner" /> Checking...
                </span>
              )}
              {usernameStatus === 'available' && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  <CheckCircle2 size={13} /> Available
                </span>
              )}
              {usernameStatus === 'taken' && (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  <XCircle size={13} /> Already taken
                </span>
              )}
            </div>
            <input
              id="reg-username"
              type="text"
              className="input-field"
              placeholder="e.g. rahim23"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              autoComplete="username"
              maxLength={20}
              style={{
                borderColor:
                  usernameStatus === 'available'
                    ? '#10b981'
                    : usernameStatus === 'taken'
                    ? '#ef4444'
                    : undefined
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Letters, numbers, underscores (3-20 chars). Must be unique.
            </span>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-name">Full Name (Optional)</label>
            <input
              id="reg-name"
              type="text"
              className="input-field"
              placeholder="e.g. Rahim Chowdhury"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={40}
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="input-field"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || usernameStatus === 'taken'}
            className="btn btn-primary auth-submit-btn"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinner" />
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <span
            onClick={() => onNavigate('login')}
            className="auth-link"
            role="button"
            tabIndex={0}
          >
            Sign in
          </span>
        </div>
      </div>
    </div>
  );
}
