import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Attach local stream to preview video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to remote video and audio elements
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

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

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Active Call">
      <div className="active-call-modal">
        {isVideoCall ? (
          /* Video Call Stage */
          <div className="call-video-stage">
            {/* Remote video */}
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
            ) : (
              /* Waiting for remote stream visual */
              <div className="call-audio-stage" style={{ width: '100%', height: '100%' }}>
                <div className="audio-call-avatar-wrapper">
                  <div className="audio-pulse-glow" />
                  <Avatar src={otherPhoto} name={otherName} size="xl" />
                </div>
                <h3 className="audio-call-name">{otherName}</h3>
                <span className="audio-call-status">
                  {callStatus === 'connected' ? 'Connecting video...' : 'Calling...'}
                </span>
              </div>
            )}

            {/* Local Video Thumbnail PIP */}
            {localStream && localStream.getVideoTracks().length > 0 && !isVideoOff && (
              <div className="local-video-pip">
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
          /* Audio Call Stage */
          <div className="call-audio-stage">
            <div className="audio-call-avatar-wrapper">
              <div className="audio-pulse-glow" />
              <Avatar src={otherPhoto} name={otherName} size="xl" />
            </div>
            <h3 className="audio-call-name">{otherName}</h3>
            <span className="audio-call-status">
              {callStatus === 'connected' ? 'Voice Call Connected' : 'Calling...'}
            </span>
            {callStatus === 'connected' && (
              <span className="audio-call-timer">{formatTimer(duration)}</span>
            )}
          </div>
        )}

        {/* Floating Call Controls Bar */}
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
            className="call-action-btn end"
            title="End call"
            aria-label="End call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
        {/* Invisible audio element to ensure remote voice is always played during audio & video calls */}
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      </div>
    </div>
  );
}
