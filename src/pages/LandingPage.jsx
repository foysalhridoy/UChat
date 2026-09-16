import React from 'react';
import { MessageSquare, Globe2, Zap, Shield, Smartphone, ArrowRight, Sun, Moon } from 'lucide-react';
import { GlobalVisual } from '../components/landing/GlobalVisual';
import { useTheme } from '../context/ThemeContext';

export function LandingPage({ onNavigate }) {
  const { toggleTheme, isDark } = useTheme();

  return (
    <div className="landing-page">
      {/* Navigation */}
      <header className="landing-nav">
        <div className="landing-brand">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary), #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <MessageSquare size={20} />
          </div>
          <span>UChat</span>
        </div>

        <div className="landing-nav-actions">
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => onNavigate('login')}
            className="btn btn-ghost"
            style={{ minHeight: 38 }}
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('register')}
            className="btn btn-primary"
            style={{ minHeight: 38 }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-badge">
          <Globe2 size={15} />
          <span>Real-time global communication platform</span>
        </div>

        <h1 className="hero-title">
          Connect beyond <span className="hero-title-highlight">borders</span>.
        </h1>

        <p className="hero-subtitle">
          Experience ultra-fast, minimal, real-time messaging designed for users everywhere.
          Create an account in seconds and connect with friends across the globe with zero friction.
        </p>

        <div className="hero-cta-group">
          <button
            onClick={() => onNavigate('register')}
            className="btn btn-primary"
            style={{ padding: '14px 28px', fontSize: '1rem' }}
          >
            <span>Start Chatting</span>
            <ArrowRight size={18} />
          </button>
          <button
            onClick={() => onNavigate('login')}
            className="btn btn-secondary"
            style={{ padding: '14px 26px', fontSize: '1rem' }}
          >
            <span>Sign In to Account</span>
          </button>
        </div>

        {/* Global Network Canvas Visual */}
        <GlobalVisual />
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={22} />
            </div>
            <h3 className="feature-title">Real-Time Messaging</h3>
            <p className="feature-desc">
              Messages sync instantly across participants with zero page refreshes, live delivery, and seen indicators.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Smartphone size={22} />
            </div>
            <h3 className="feature-title">Mobile-First Experience</h3>
            <p className="feature-desc">
              Engineered from the ground up for seamless touch interaction, keyboard-friendly input, and fluid mobile transitions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Shield size={22} />
            </div>
            <h3 className="feature-title">Private & Secure</h3>
            <p className="feature-desc">
              Backed by strict Firestore Security Rules, ensuring conversations and personal profiles remain completely protected.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <a
          href="https://github.com/foysalhridoy"
          target="_blank"
          rel="noopener noreferrer"
          className="developer-badge"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          <span>Developed by Hridoy</span>
        </a>
      </footer>
    </div>
  );
}
