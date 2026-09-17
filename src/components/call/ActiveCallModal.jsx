import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, ShieldCheck } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { unlockAudio, getActiveAudioContext } from '../../services/callService';

export function ActiveCallModal({
  call,
  localStream,
  remoteStream,
  streamVersion = 0,
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
  const audioSourceRef = useRef(null);

  const isVideoCall = call?.type === 'video';
  const otherName = call?.otherUserName || call?.receiverName || call?.callerName || 'User';
  const otherPhoto = call?.otherUserPhoto || call?.receiverPhoto || call?.callerPhoto || '';

  // Check if remote stream has active video track
  const hasRemoteVideoTrack = Boolean(
    isVideoCall &&
    remoteStream &&
    typeof remoteStream.getVideoTracks === 'function' &&
    remoteStream.getVideoTracks().length > 0 &&
    remoteStream.getVideoTracks().some((t) => t.enabled)
  );

  // Hook Web Audio API directly to incoming audio tracks for bypass of HTMLMediaElement mobile blocks
  useEffect(() => {
    if (!remoteStream) return;

    try {
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks && audioTracks.length > 0) {
        const ctx = getActiveAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          if (audioSourceRef.current) {
            try { audioSourceRef.current.disconnect(); } catch (e) {}
          }
          const streamToRoute = new MediaStream(audioTracks);
          const sourceNode = ctx.createMediaStreamSource(streamToRoute);
          sourceNode.connect(ctx.destination);
          audioSourceRef.current = sourceNode;
          console.log('[ActiveCallModal] Web Audio sink connected successfully!');
        }
      }
    } catch (err) {
      console.warn('[ActiveCallModal] Web Audio hook warning:', err);
    }

    return () => {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.disconnect(); } catch (e) {}
        audioSourceRef.current = null;
      }
    };
  }, [remoteStream, streamVersion]);

  // Synchronize remote media stream to appropriate media element
  useEffect(() => {
    if (!remoteStream) return;

    // In both voice and video calls, attach stream to dedicated audio element for direct sound playback
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[ActiveCallModal] Remote audio play blocked by browser policy:', err);
        setAudioBlocked(true);
      });
    }

    if (isVideoCall) {
      // In video call: <video> element handles visual display
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch((err) => {
          console.warn('[ActiveCallModal] Remote video unmuted play blocked, falling back to muted video display:', err);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch(() => {});
          }
          setAudioBlocked(true);
        });
      }
    } else {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream, streamVersion, isVideoCall]);

  // Synchronize local video preview PIP
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
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
  const handleUserInteract = () => {
    unlockAudio();
    const ctx = getActiveAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (audioBlocked) {
      setAudioBlocked(false);
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (isVideoCall && remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.play().catch(() => {});
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

  return (
    <div
      className="call-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Active Call"
      onClick={handleUserInteract}
    >
      <div className="active-call-modal">
        {/* Mobile Browser Autoplay Unmute Banner */}
        {audioBlocked && (
          <div
            onClick={handleUserInteract}
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
          <div className="call-video-stage" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Remote video element - ALWAYS mounted so browser never halts decoding or audio */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: hasRemoteVideoTrack ? 1 : 0,
                zIndex: hasRemoteVideoTrack ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            />

            {/* Waiting/Connecting Avatar placeholder when remote video has not arrived yet */}
            {!hasRemoteVideoTrack && (
              <div
                className="call-audio-stage"
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: '100%',
                  height: '100%'
                }}
              >
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
              <div className="local-video-pip" style={{ zIndex: 10 }}>
                <video
                  ref={localVideoRef}
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
            onClick={(e) => {
              e.stopPropagation();
              toggleMic();
            }}
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
              onClick={(e) => {
                e.stopPropagation();
                toggleVideo();
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              onEndCall();
            }}
            className="call-action-circle-btn end"
            title="End call"
            aria-label="End call"
            style={{ width: 56, height: 56 }}
          >
            <PhoneOff size={24} />
          </button>
        </div>

        {/* Remote audio playback element - position fixed offscreen so mobile browser never pauses it */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          style={{
            position: 'fixed',
            top: -1000,
            left: -1000,
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
