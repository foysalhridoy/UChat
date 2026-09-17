import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, ShieldCheck } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { playRingtone, stopRingtone, unlockAudio } from '../../services/callService';

export function IncomingCallModal({ call, onAccept, onDecline }) {
  useEffect(() => {
    playRingtone('incoming');
    return () => {
      stopRingtone();
    };
  }, []);

  if (!call) return null;

  const isVideo = call.type === 'video';

  const handleAccept = () => {
    unlockAudio();
    if (onAccept) onAccept();
  };

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Incoming Call">
      <div className="incoming-call-card">
        {/* Security Badge */}
        <div className="call-security-badge">
          <ShieldCheck size={13} color="#10b981" />
          <span>End-to-end encrypted</span>
        </div>

        {/* Concentric Pulsing Ripples (WhatsApp Style) */}
        <div className="incoming-avatar-wrapper">
          <div className="ripple-wave" />
          <div className="ripple-wave" />
          <div className="ripple-wave" />
          <Avatar
            src={call.callerPhoto}
            name={call.callerName}
            size="xl"
          />
        </div>

        <h3 className="incoming-call-name">{call.callerName}</h3>

        <div className="incoming-call-type-pill">
          {isVideo ? <Video size={15} /> : <Phone size={15} />}
          <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        {/* Actions with WhatsApp/Messenger Style Decline & Accept Buttons */}
        <div className="incoming-call-actions">
          {/* Decline */}
          <div className="call-action-group">
            <button
              onClick={onDecline}
              className="call-action-circle-btn decline"
              title="Decline call"
              aria-label="Decline call"
            >
              <PhoneOff size={28} />
            </button>
            <span className="call-action-label">Decline</span>
          </div>

          {/* Accept */}
          <div className="call-action-group">
            <button
              onClick={handleAccept}
              className="call-action-circle-btn accept"
              title="Accept call"
              aria-label="Accept call"
            >
              {isVideo ? <Video size={28} /> : <Phone size={28} />}
            </button>
            <span className="call-action-label">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
