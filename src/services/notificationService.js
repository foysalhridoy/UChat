/**
 * Notification Service for UChat
 * Handles System Desktop/Mobile Notifications, Service Worker alerts,
 * Background Tab Title Flashes, and Web Audio notification sounds.
 */

let swRegistration = null;
let titleFlashInterval = null;
let originalDocumentTitle = document.title || 'UChat';
let audioContext = null;

// Sound synthesizer using Web Audio API (zero external asset dependencies)
export function playMessageChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    // Dual-stage pleasant melodic chime (880Hz -> 1174Hz)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (err) {
    console.warn('Audio chime warning:', err);
  }
}

/**
 * Initializes Service Worker for background notifications
 */
export async function initNotifications(onNotificationClick) {
  if (typeof window === 'undefined') return;

  // Remember original document title
  originalDocumentTitle = document.title || 'UChat';

  // Listen for focus to stop title flashes
  window.addEventListener('focus', () => {
    stopTitleFlash();
  });

  // Register Service Worker if supported
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('UChat Notification Service Worker registered.');

      // Listen for messages from Service Worker (e.g. notification clicked while minimized)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          if (onNotificationClick) {
            onNotificationClick(event.data);
          }
        }
      });
    } catch (err) {
      console.warn('Service Worker registration skipped or failed:', err);
    }
  }
}

/**
 * Checks if Notifications are supported in current browser
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Current notification permission state
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Requests permission from user to show system notifications
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Flashes browser tab title when tab is minimized or in background
 */
export function startTitleFlash(alertText) {
  stopTitleFlash();
  if (typeof document === 'undefined') return;

  let isAlert = true;
  titleFlashInterval = setInterval(() => {
    document.title = isAlert ? alertText : originalDocumentTitle;
    isAlert = !isAlert;
  }, 1200);
}

/**
 * Stops title flashing and restores original title
 */
export function stopTitleFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  if (typeof document !== 'undefined') {
    document.title = originalDocumentTitle;
  }
}

/**
 * Displays a system notification for incoming messages
 */
export async function showMessageNotification({ senderName, text, icon, conversationId, onClick }) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    // If system notifications are not granted, at least flash title and chime if tab is hidden
    if (document.hidden) {
      playMessageChime();
      startTitleFlash(`💬 ${senderName}: ${text ? text.slice(0, 24) : 'New message'}`);
    }
    return;
  }

  const title = senderName || 'New message on UChat';
  const body = text || 'Sent an attachment';
  const notificationIcon = icon || '/favicon.svg';

  // Play audio chime if minimized/hidden
  if (document.hidden) {
    playMessageChime();
    startTitleFlash(`💬 ${senderName}: ${body.slice(0, 20)}`);
  }

  try {
    // Prefer Service Worker notification (works reliably when minimized)
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, {
        body,
        icon: notificationIcon,
        badge: '/favicon.svg',
        tag: `msg-${conversationId || 'chat'}`,
        renotify: true,
        data: { conversationId },
        vibrate: [100, 50, 100]
      });
    } else {
      // Fallback to standard Notification API
      const notif = new Notification(title, {
        body,
        icon: notificationIcon,
        tag: `msg-${conversationId || 'chat'}`,
        renotify: true
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        stopTitleFlash();
        if (onClick) onClick();
      };
    }
  } catch (err) {
    console.warn('Error displaying message notification:', err);
  }
}

// Keep track of active incoming call notification to close it when call ends
let activeCallNotification = null;

/**
 * Displays an incoming call notification with ringtone vibration
 */
export async function showCallNotification({ callerName, callerPhoto, isVideo, callId, onAccept, onDecline }) {
  const callType = isVideo ? 'Video Call' : 'Voice Call';
  const title = `📞 Incoming ${callType}`;
  const body = `${callerName || 'Someone'} is calling you on UChat...`;
  const icon = callerPhoto || '/favicon.svg';

  // Always flash tab title
  startTitleFlash(`📞 Incoming Call from ${callerName || 'User'}!`);

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  try {
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, {
        body,
        icon,
        badge: '/favicon.svg',
        tag: `call-${callId}`,
        requireInteraction: true, // Keep on screen until answered or declined
        vibrate: [400, 200, 400, 200, 800],
        data: { callId, isCall: true },
        actions: [
          { action: 'accept', title: 'Answer' },
          { action: 'decline', title: 'Decline' }
        ]
      });
    } else {
      const notif = new Notification(title, {
        body,
        icon,
        tag: `call-${callId}`,
        requireInteraction: true
      });

      activeCallNotification = notif;

      notif.onclick = () => {
        window.focus();
        notif.close();
        stopTitleFlash();
        if (onAccept) onAccept();
      };
    }
  } catch (err) {
    console.warn('Error showing call notification:', err);
  }
}

/**
 * Dismisses the active call notification once the call is connected or declined
 */
export async function dismissCallNotification(callId) {
  stopTitleFlash();

  if (activeCallNotification) {
    try {
      activeCallNotification.close();
    } catch {}
    activeCallNotification = null;
  }

  if (swRegistration && swRegistration.getNotifications) {
    try {
      const notifs = await swRegistration.getNotifications({ tag: `call-${callId}` });
      notifs.forEach((n) => n.close());
    } catch {}
  }
}
