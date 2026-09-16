import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { playRingtone, stopRingtone } from '../../services/callService';

export function IncomingCallModal({ call, onAccept, onDecline }) {
  useEffect(() => {
    playRingtone('incoming');
    return () => {
      stopRingtone();
    };
  }, []);

  if (!call) return null;

  const isVideo = call.type === 'video';

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Incoming Call">
      <div className="incoming-call-card">
        <div className="incoming-avatar-wrapper">
          <div className="incoming-pulse-ring" />
          <Avatar
            src={call.callerPhoto}
            name={call.callerName}
            size="xl"
          />
        </div>

        <h3 className="incoming-call-name">{call.callerName}</h3>

        <div className="incoming-call-type">
          {isVideo ? <Video size={16} /> : <Phone size={16} />}
          <span>Incoming {isVideo ? 'Video' : 'Audio'} Call</span>
        </div>

        <div className="incoming-call-actions">
          {/* Decline Button */}
          <button
            onClick={onDecline}
            className="call-action-btn decline"
            title="Decline call"
            aria-label="Decline call"
          >
            <PhoneOff size={26} />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="call-action-btn accept"
            title="Accept call"
            aria-label="Accept call"
          >
            {isVideo ? <Video size={26} /> : <Phone size={26} />}
          </button>
        </div>
      </div>
    </div>
  );
}
