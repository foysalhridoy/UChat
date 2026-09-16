import React, { useState } from 'react';
import { AlertTriangle, Key, ExternalLink, Copy, Check } from 'lucide-react';
import { Modal } from './Modal';
import { isFirebaseConfigured } from '../../services/firebase';

export function FirebaseSetupBanner() {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isFirebaseConfigured) return null;

  const envTemplate = `# .env file in project root
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`;

  const copyEnv = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <aside className="setup-banner" aria-label="Firebase configuration alert">
        <div className="setup-banner-content">
          <AlertTriangle size={18} />
          <span>Firebase credentials required to enable live authentication and real-time messaging.</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="setup-banner-btn"
          aria-label="View setup instructions"
        >
          Setup Guide
        </button>
      </aside>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Firebase Setup Instructions"
        maxWidth={540}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            UChat communicates in real-time with <strong>Firebase Authentication</strong> and <strong>Cloud Firestore</strong>. Follow these 3 quick steps:
          </p>

          <ol style={{ paddingLeft: 20, fontSize: '0.9rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text-primary)' }}>
            <li>
              Go to the{' '}
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Firebase Console <ExternalLink size={14} />
              </a>
              {' '}and click <strong>Add Project</strong>.
            </li>
            <li>
              In your project, enable:
              <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                <li><strong>Authentication</strong>: Enable <em>Email/Password</em> provider under Sign-in method.</li>
                <li><strong>Cloud Firestore</strong>: Create a database in production mode.</li>
              </ul>
            </li>
            <li>
              Register a <strong>Web App (&lt;/&gt;)</strong> in Project Settings, copy the configuration credentials, and paste them into a <code>.env</code> file in the project root:
            </li>
          </ol>

          <div style={{ position: 'relative' }}>
            <pre
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace'
              }}
            >
              {envTemplate}
            </pre>
            <button
              onClick={copyEnv}
              className="btn btn-secondary btn-icon"
              style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30 }}
              title="Copy .env template"
            >
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            After updating <code>.env</code>, restart your Vite dev server (<code>npm run dev</code>).
          </p>
        </div>
      </Modal>
    </>
  );
}
