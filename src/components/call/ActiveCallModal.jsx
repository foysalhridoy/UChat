import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, ShieldCheck } from 'lucide-react';
import { Avatar } from '../common/Avatar';

export function ActiveCallModal({
  call,
  localStream,
  remoteStream,
  callStatus = 'calling', // 'calling' | 'connecting' | 'connected'
  onEndCall
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Callback ref for remote video to guarantee srcObject is attached the instant it mounts in DOM
  const setRemoteVideoRef = (element) => {
    remoteVideoRef.current = element;
    if (element && remoteStream) {
      if (element.srcObject !== remoteStream) {
        element.srcObject = remoteStream;
      }
      element.play().catch((err) => {
        console.warn('Remote video autoplay blocked:', err);
        setAudioBlocked(true);
      });
    }
  };

  // Callback ref for remote audio
  const setRemoteAudioRef = (element) => {
    remoteAudioRef.current = element;
    if (element && remoteStream) {
      if (element.srcObject !== remoteStream) {
        element.srcObject = remoteStream;
      }
      element.play().catch((err) => {
        console.warn('Remote audio autoplay blocked:', err);
        setAudioBlocked(true);
      });
    }
  };

  // Callback ref for local video preview PIP
  const setLocalVideoRef = (element) => {
    localVideoRef.current = element;
    if (element && localStream) {
      if (element.srcObject !== localStream) {
        element.srcObject = localStream;
      }
      element.play().catch(() => {});
    }
  };

  // Synchronize when remoteStream reference changes
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => setAudioBlocked(true));
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => setAudioBlocked(true));
      }
    }
  }, [remoteStream]);

  // Synchronize when localStream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Duration timer once call is connected
  useEffect(() => {
    let interval = null;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // User gesture handler to unlock mobile audio autoplay if blocked by browser
  const handleUnlockAudio = () => {
    setAudioBlocked(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVideoCall = call.type === 'video';
  const otherName = call.otherUserName || call.receiverName || call.callerName || 'User';
  const otherPhoto = call.otherUserPhoto || call.receiverPhoto || call.callerPhoto || '';

  // Check if remote stream has active video track
  const hasRemoteVideoTrack = Boolean(
    remoteStream && remoteStream.getVideoTracks && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled
  );

  return (
    <div
      className="call-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Active Call"
      onClick={audioBlocked ? handleUnlockAudio : undefined}
    >
      <div className="active-call-modal">
        {/* Mobile Browser Autoplay Unmute Banner */}
        {audioBlocked && (
          <div
            onClick={handleUnlockAudio}
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              background: 'rgba(37, 99, 235, 0.95)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 24,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              animation: 'pulse 1.5s infinite'
            }}
          >
            <Volume2 size={18} />
            <span>Tap anywhere to enable sound</span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="call-header-top">
          <div className="call-security-badge" style={{ margin: 0 }}>
            <ShieldCheck size={13} color="#10b981" />
            <span>End-to-end encrypted</span>
          </div>

          <div className="call-status-pill">
            <span className="call-status-indicator-dot" />
            <span>{isVideoCall ? 'Video Call' : 'Voice Call'}</span>
          </div>
        </div>

        {isVideoCall ? (
          /* Video Call Stage */
          <div className="call-video-stage">
            {/* Remote video element - ALWAYS rendered so ref never misses attachment */}
            <video
              ref={setRemoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
              style={{
                display: hasRemoteVideoTrack ? 'block' : 'none',
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />

            {/* Waiting/Connecting Avatar placeholder when remote video has not arrived yet */}
            {!hasRemoteVideoTrack && (
              <div className="call-audio-stage" style={{ width: '100%', height: '100%' }}>
                <div className="audio-call-avatar-wrapper">
                  {callStatus === 'calling' && (
                    <>
                      <div className="ripple-wave" />
                      <div className="ripple-wave" />
                      <div className="ripple-wave" />
                    </>
                  )}
                  <div className="audio-pulse-glow" />
                  <Avatar src={otherPhoto} name={otherName} size="xl" />
                </div>
                <h3 className="audio-call-name">{otherName}</h3>
                <span className="audio-call-status">
                  {callStatus === 'connected' ? 'Connected (waiting for video...)' : 'Calling...'}
                </span>
                {callStatus === 'connected' && (
                  <span className="audio-call-timer">{formatTimer(duration)}</span>
                )}
              </div>
            )}

            {/* Local Video Thumbnail PIP */}
            {localStream && localStream.getVideoTracks().length > 0 && !isVideoOff && (
              <div className="local-video-pip">
                <video
                  ref={setLocalVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="local-video"
                />
              </div>
            )}
          </div>
        ) : (
          /* Audio Call Stage (WhatsApp & Messenger Style) */
          <div className="call-audio-stage">
            <div className="audio-call-avatar-wrapper">
              {callStatus === 'calling' && (
                <>
                  <div className="ripple-wave" />
                  <div className="ripple-wave" />
                  <div className="ripple-wave" />
                </>
              )}
              <div className="audio-pulse-glow" />
              <Avatar src={otherPhoto} name={otherName} size="xl" />
            </div>

            <h3 className="audio-call-name">{otherName}</h3>
            
            <span className="audio-call-status">
              {callStatus === 'connected'
                ? 'Voice Call Connected'
                : 'Calling...'}
            </span>

            {callStatus === 'connected' ? (
              <>
                <span className="audio-call-timer">{formatTimer(duration)}</span>
                {/* Dynamic live sound waves indicator */}
                <div className="sound-waves-container">
                  <div className="sound-wave-bar" />
                  <div className="sound-wave-bar" />
                  <div className="sound-wave-bar" />
                  <div className="sound-wave-bar" />
                  <div className="sound-wave-bar" />
                  <div className="sound-wave-bar" />
                </div>
              </>
            ) : (
              <div className="sound-waves-container" style={{ opacity: 0.2 }}>
                <div className="sound-wave-bar" />
                <div className="sound-wave-bar" />
                <div className="sound-wave-bar" />
                <div className="sound-wave-bar" />
                <div className="sound-wave-bar" />
                <div className="sound-wave-bar" />
              </div>
            )}
          </div>
        )}

        {/* Floating WhatsApp/Messenger Capsule Controls Bar */}
        <div className="call-controls-bar">
          {/* Mute Microphone */}
          <button
            type="button"
            onClick={toggleMic}
            className={`call-control-toggle-btn ${isMuted ? 'off' : ''}`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Toggle Camera (for video calls) */}
          {isVideoCall && (
            <button
              type="button"
              onClick={toggleVideo}
              className={`call-control-toggle-btn ${isVideoOff ? 'off' : ''}`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          {/* End Call */}
          <button
            type="button"
            onClick={onEndCall}
            className="call-action-circle-btn end"
            title="End call"
            aria-label="End call"
            style={{ width: 56, height: 56 }}
          >
            <PhoneOff size={24} />
          </button>
        </div>

        {/* Remote audio playback element - position fixed with 0.01 opacity so mobile browser thread never pauses it */}
        <audio
          ref={setRemoteAudioRef}
          autoPlay
          playsInline
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: 1,
            height: 1,
            opacity: 0.01,
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  );
}
