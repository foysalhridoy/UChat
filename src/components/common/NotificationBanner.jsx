import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission
} from '../../services/notificationService';

export function NotificationBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isNotificationSupported()) {
      const permission = getNotificationPermission();
      const dismissed = localStorage.getItem('uchat_notif_banner_dismissed');
      if (permission === 'default' && !dismissed) {
        setShowBanner(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('uchat_notif_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        borderBottom: '1px solid rgba(37, 99, 235, 0.22)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        gap: 12,
        zIndex: 50,
        animation: 'fadeIn 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Bell size={16} />
        </div>
        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Get notified for incoming calls & messages when browser is in background
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleEnable}
          className="btn btn-primary"
          style={{ padding: '5px 14px', minHeight: 30, fontSize: '0.8rem', borderRadius: 20 }}
        >
          Enable
        </button>
        <button
          onClick={handleDismiss}
          className="btn btn-ghost btn-icon"
          style={{ width: 28, height: 28 }}
          title="Dismiss"
          aria-label="Dismiss notification prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
