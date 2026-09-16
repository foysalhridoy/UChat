import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

// Web Audio API Ringtone Synthesizer
let audioCtx = null;
let ringtoneInterval = null;

export function playRingtone(type = 'incoming') {
  stopRingtone();
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();

    const playTone = () => {
      if (!audioCtx || audioCtx.state === 'closed') return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'incoming') {
        // Musical electronic chime (E5 -> G#5)
        osc1.frequency.setValueAtTime(659.25, now);
        osc2.frequency.setValueAtTime(830.61, now + 0.15);
      } else {
        // Standard phone ringing cadence (440Hz + 480Hz)
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
      }

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);
    };

    playTone();
    ringtoneInterval = setInterval(playTone, 2200);
  } catch (err) {
    console.warn('Audio ringtone synth error:', err);
  }
}

export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close().catch(() => {});
    } catch (e) {}
    audioCtx = null;
  }
}

/**
 * Acquire local audio/video media stream with fallback
 */
export async function getLocalMediaStream(type = 'video') {
  const wantsVideo = type === 'video';
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: wantsVideo
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        : false
    });
  } catch (err) {
    // If video fails (e.g. no camera attached), fallback to audio-only
    if (wantsVideo) {
      console.warn('Camera not accessible, attempting audio-only fallback:', err);
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
    }
    throw err;
  }
}

/**
 * Start an outgoing WebRTC call
 */
export async function initiateCall({
  caller,
  receiver,
  type = 'video',
  onRemoteStream,
  onCallActive,
  onCallRejected,
  onCallEnded
}) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  playRingtone('outgoing');

  // 1. Get local stream
  const localStream = await getLocalMediaStream(type);

  // 2. Initialize Peer Connection
  const peerConnection = new RTCPeerConnection(rtcConfig);

  // Add tracks
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle incoming remote tracks
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      stopRingtone();
      if (onRemoteStream) onRemoteStream(event.streams[0]);
    }
  };

  // 3. Create Call Document in Firestore
  const callDocRef = doc(collection(db, 'calls'));
  const callId = callDocRef.id;

  const offerCandidatesCol = collection(db, 'calls', callId, 'offerCandidates');
  const answerCandidatesCol = collection(db, 'calls', callId, 'answerCandidates');

  // Save local ICE candidates to offerCandidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidatesCol, event.candidate.toJSON()).catch((e) => {
        console.warn('Error adding ICE candidate:', e);
      });
    }
  };

  // 4. Create and set Offer SDP
  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

  const callData = {
    callId,
    callerId: caller.uid,
    callerName: caller.displayName || caller.username || 'User',
    callerPhoto: caller.photoURL || '',
    receiverId: receiver.uid || receiver.id,
    receiverName: receiver.displayName || receiver.username || 'User',
    receiverPhoto: receiver.photoURL || '',
    type,
    status: 'calling', // 'calling' | 'active' | 'rejected' | 'ended'
    createdAt: serverTimestamp(),
    offer: {
      sdp: offerDescription.sdp,
      type: offerDescription.type
    }
  };

  await setDoc(callDocRef, callData);

  // 5. Listen for Receiver Answer or Status Change
  const unsubCall = onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    if (data.status === 'rejected') {
      stopRingtone();
      cleanup();
      if (onCallRejected) onCallRejected();
    } else if (data.status === 'ended') {
      stopRingtone();
      cleanup();
      if (onCallEnded) onCallEnded();
    } else if (data.status === 'active' || data.answer) {
      stopRingtone();
      if (onCallActive) onCallActive();
      if (data.answer && !peerConnection.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription).catch((e) => {
          console.warn('Set remote description failed:', e);
        });
      }
    }
  });

  // 6. Listen for Remote ICE Candidates from Receiver
  const unsubAnswerCandidates = onSnapshot(answerCandidatesCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate).catch((e) => {
          console.warn('Error adding remote ICE candidate:', e);
        });
      }
    });
  });

  const cleanup = () => {
    stopRingtone();
    unsubCall();
    unsubAnswerCandidates();
    localStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
  };

  const endCall = async () => {
    try {
      await updateDoc(callDocRef, { status: 'ended' });
    } catch (e) {}
    cleanup();
  };

  return {
    callId,
    localStream,
    peerConnection,
    endCall
  };
}

/**
 * Answer an incoming call
 */
export async function answerCall({
  call,
  onRemoteStream,
  onCallEnded
}) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  stopRingtone();

  const callDocRef = doc(db, 'calls', call.callId);
  const offerCandidatesCol = collection(db, 'calls', call.callId, 'offerCandidates');
  const answerCandidatesCol = collection(db, 'calls', call.callId, 'answerCandidates');

  // 1. Acquire local stream
  const localStream = await getLocalMediaStream(call.type);

  // 2. Initialize Peer Connection
  const peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      if (onRemoteStream) onRemoteStream(event.streams[0]);
    }
  };

  // 3. Save local answer ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidatesCol, event.candidate.toJSON()).catch((e) => {
        console.warn('Error adding answer ICE candidate:', e);
      });
    }
  };

  // 4. Set remote offer & create Answer
  await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  // 5. Update call doc with Answer and set status to active
  await updateDoc(callDocRef, {
    status: 'active',
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp
    }
  });

  // 6. Listen for caller's ICE candidates
  const unsubOfferCandidates = onSnapshot(offerCandidatesCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate).catch((e) => {
          console.warn('Error adding offer ICE candidate:', e);
        });
      }
    });
  });

  // 7. Listen for call termination
  const unsubCall = onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!data || data.status === 'ended' || data.status === 'rejected') {
      cleanup();
      if (onCallEnded) onCallEnded();
    }
  });

  const cleanup = () => {
    stopRingtone();
    unsubCall();
    unsubOfferCandidates();
    localStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
  };

  const endCall = async () => {
    try {
      await updateDoc(callDocRef, { status: 'ended' });
    } catch (e) {}
    cleanup();
  };

  return {
    callId: call.callId,
    localStream,
    peerConnection,
    endCall
  };
}

/**
 * Reject incoming call
 */
export async function rejectIncomingCall(callId) {
  stopRingtone();
  if (!isFirebaseConfigured || !db || !callId) return;
  try {
    const callDocRef = doc(db, 'calls', callId);
    await updateDoc(callDocRef, { status: 'rejected' });
  } catch (err) {
    console.warn('Error rejecting call:', err);
  }
}

/**
 * Subscribe to incoming calls for current user
 */
export function subscribeToIncomingCalls(userId, onIncomingCall) {
  if (!isFirebaseConfigured || !db || !userId) return () => {};

  const callsCol = collection(db, 'calls');
  const q = query(
    callsCol,
    where('receiverId', '==', userId),
    where('status', '==', 'calling')
  );

  return onSnapshot(q, (snapshot) => {
    const calls = [];
    const now = Date.now();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAtMillis = data.createdAt?.toMillis ? data.createdAt.toMillis() : now;
      // Only notify if call is fresh (< 45 seconds old)
      if (now - createdAtMillis < 45000) {
        calls.push({ id: docSnap.id, ...data });
      }
    });

    if (calls.length > 0) {
      onIncomingCall(calls[0]);
    } else {
      onIncomingCall(null);
    }
  }, (err) => {
    console.error('Error listening to incoming calls:', err);
  });
}
