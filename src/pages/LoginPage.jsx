import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, AlertCircle, Loader2, User, Lock, Eye, EyeOff } from 'lucide-react';
import { loginUser, getFriendlyErrorMessage } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { isFirebaseConfigured } from '../services/firebase';

export function LoginPage({ onNavigate }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const handleInputFocus = (e) => {
    // Smoothly scroll input into center of screen when mobile keyboard opens
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 280);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFirebaseConfigured) {
      setError('Firebase credentials are not configured yet. Please check the setup instructions.');
      return;
    }

    if (!identifier.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      await loginUser(identifier, password);
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
          <span>Home</span>
        </a>

        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-brand-badge">
              <MessageSquare size={28} />
            </div>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to connect with friends instantly</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="login-username">Username or Email</label>
            <div className="auth-input-container">
              <User size={18} className="auth-input-icon" />
              <input
                id="login-username"
                type="text"
                className="auth-input-field"
                placeholder="e.g. rahim23"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onFocus={handleInputFocus}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="login-password">Password</label>
            <div className="auth-input-container">
              <Lock size={18} className="auth-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input-field"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handleInputFocus}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
            Create account
          </span>
        </div>
      </div>
    </div>
  );
}
