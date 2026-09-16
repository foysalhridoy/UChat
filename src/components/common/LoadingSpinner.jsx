import React from 'react';

export function LoadingSpinner({ text = 'Loading...', size = 'md' }) {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 36
  };

  const dim = sizeMap[size] || 24;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        color: 'var(--text-secondary)'
      }}
      role="status"
    >
      <div
        className="spinner"
        style={{ width: dim, height: dim, color: 'var(--primary)' }}
      />
      {text && <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{text}</span>}
    </div>
  );
}
