import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { loginUser, getFriendlyErrorMessage } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { isFirebaseConfigured } from '../services/firebase';

export function LoginPage({ onNavigate }) {
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

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await loginUser(email, password);
      showToast('Welcome back to UChat!', 'success');
      onNavigate('chat');
    } catch (err) {
      console.error('Login error:', err);
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
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your UChat account to continue</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
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
            <label className="input-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <span
            onClick={() => onNavigate('register')}
            className="auth-link"
            role="button"
            tabIndex={0}
          >
            Create an account
          </span>
        </div>
      </div>
    </div>
  );
}
