import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { registerUser, getFriendlyErrorMessage } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { isFirebaseConfigured } from '../services/firebase';
import { isValidUsername, validatePassword, isValidEmail } from '../utils/validation';

export function RegisterPage({ onNavigate }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

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

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
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
        email,
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
          <p className="auth-subtitle">Join UChat and connect across borders</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="reg-username">Username</label>
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
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Letters, numbers, underscores (3-20 chars)
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
            <label className="input-label" htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
            disabled={loading}
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
