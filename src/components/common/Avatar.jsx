import React from 'react';

export function Avatar({
  src,
  name = 'User',
  size = 'md',
  status,
  showStatus = false,
  className = ''
}) {
  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  const sizeClass = `avatar-${size}`;

  return (
    <div className={`avatar-container ${sizeClass} ${className}`} aria-label={name}>
      {src ? (
        <img
          src={src}
          alt={name}
          className="avatar-img"
          onError={(e) => {
            // fallback to initials on error
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span className="avatar-initials" style={{ display: src ? 'none' : 'inline' }}>
        {getInitials(name)}
      </span>
      {showStatus && status && (
        <span
          className={`status-indicator ${status}`}
          title={status === 'online' ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
