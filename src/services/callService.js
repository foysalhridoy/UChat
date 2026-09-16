import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  query,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getConversationId } from './conversationService';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.relay.metered.ca:80' }
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
 * Wait for ICE gathering to complete or timeout.
 * Embedding gathered candidates directly in localDescription.sdp drastically speeds up P2P connection.
 */
async function waitForIceGathering(peerConnection, maxWaitMs = 500) {
  if (peerConnection.iceGatheringState === 'complete') return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, maxWaitMs);
    const handler = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timer);
        peerConnection.removeEventListener('icegatheringstatechange', handler);
        resolve();
      }
    };
    peerConnection.addEventListener('icegatheringstatechange', handler);
  });
}

/**
 * Acquire local audio/video media stream with resilient fallback
 */
export async function getLocalMediaStream(type = 'video') {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'HTTPS_REQUIRED: WebRTC calling requires a secure HTTPS connection. If you are on an http:// or local IP address, please open your deployed Vercel HTTPS URL (https://...) in Google Chrome.'
    );
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error(
      'BROWSER_UNSUPPORTED: Media capture is not supported in this browser. Please open the site in Google Chrome or Safari.'
    );
  }

  const wantsVideo = type === 'video';

  if (wantsVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' }
      });
    } catch (videoErr) {
      console.warn('Camera with facingMode failed, trying generic video:', videoErr);
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
      } catch (videoErr2) {
        console.warn('Camera completely unavailable, falling back to audio-only stream:', videoErr2);
        return await getLocalAudioStream();
      }
    }
  }

  return await getLocalAudioStream();
}

async function getLocalAudioStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.warn('Standard audio failed, trying with audio constraints:', err);
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch (err2) {
      throw err;
    }
  }
}

/**
 * Start an outgoing WebRTC call.
 * Uses existing allowed conversations/{conversationId} collection for signaling.
 */
export async function initiateCall({
  conversationId,
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

  const callerUid = caller.uid || caller.id;
  const receiverUid = receiver.uid || receiver.id;
  if (!receiverUid || !callerUid) {
    throw new Error('Recipient or caller information is missing.');
  }

  const convId = conversationId || getConversationId(callerUid, receiverUid);
  const convRef = doc(db, 'conversations', convId);

  // 1. Acquire local media stream first
  const localStream = await getLocalMediaStream(type);

  playRingtone('outgoing');

  // 2. Initialize WebRTC Peer Connection
  const peerConnection = new RTCPeerConnection(rtcConfig);

  // Add all local tracks
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Prepare transceiver for video if caller wants video but has no camera
  if (type === 'video' && !localStream.getVideoTracks().length) {
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
  }

  // Persistent MediaStream accumulator for all incoming tracks
  const remoteStream = new MediaStream();

  peerConnection.ontrack = (event) => {
    stopRingtone();
    if (event.streams && event.streams[0]) {
      event.streams[0].getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else if (event.track) {
      if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }
    if (onRemoteStream) onRemoteStream(remoteStream);
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      stopRingtone();
      if (onCallActive) onCallActive();
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (
      peerConnection.iceConnectionState === 'connected' ||
      peerConnection.iceConnectionState === 'completed'
    ) {
      stopRingtone();
      if (onCallActive) onCallActive();
    }
  };

  // Buffer ICE candidates before document creation, then batch flush
  const earlyCandidates = [];
  let isDocInitialized = false;
  const pendingBatch = [];
  let batchTimeout = null;

  const flushCandidatesBatch = () => {
    if (pendingBatch.length === 0) return;
    const toSend = [...pendingBatch];
    pendingBatch.length = 0;
    if (toSend.length > 0) {
      updateDoc(convRef, {
        'activeCall.offerCandidates': arrayUnion(...toSend)
      }).catch((err) => {
        console.warn('Error flushing offer candidates:', err);
      });
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candObj = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      };
      if (!isDocInitialized) {
        earlyCandidates.push(candObj);
      } else {
        pendingBatch.push(candObj);
        if (!batchTimeout) {
          batchTimeout = setTimeout(() => {
            batchTimeout = null;
            flushCandidatesBatch();
          }, 300);
        }
      }
    }
  };

  // 3. Create Offer SDP & wait briefly for ICE gathering
  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);
  await waitForIceGathering(peerConnection, 500);

  const localOffer = peerConnection.localDescription || offerDescription;
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const callData = {
    callId,
    conversationId: convId,
    callerId: callerUid,
    callerName: caller.displayName || caller.username || 'User',
    callerPhoto: caller.photoURL || '',
    receiverId: receiverUid,
    receiverName: receiver.displayName || receiver.username || 'User',
    receiverPhoto: receiver.photoURL || '',
    type: type || 'audio',
    status: 'calling', // 'calling' | 'active' | 'rejected' | 'ended'
    createdAt: Date.now(),
    offer: {
      sdp: localOffer.sdp || '',
      type: localOffer.type || 'offer'
    },
    answer: null,
    offerCandidates: earlyCandidates,
    answerCandidates: []
  };

  // 4. Save to Firestore conversation document (creates or merges cleanly)
  await setDoc(
    convRef,
    {
      id: convId,
      participants: [callerUid, receiverUid],
      participantMap: {
        [callerUid]: true,
        [receiverUid]: true
      },
      activeCall: callData
    },
    { merge: true }
  );
  isDocInitialized = true;

  // Queue any candidates generated during setDoc
  if (pendingBatch.length > 0) {
    flushCandidatesBatch();
  }

  // 5. Listen for Receiver response & ICE candidates
  const seenAnswerCandidates = new Set();
  const answerQueue = [];
  let isRemoteDescSet = false;

  const unsub = onSnapshot(convRef, async (snapshot) => {
    const data = snapshot.data();
    if (!data || !data.activeCall) return;
    const call = data.activeCall;

    // Check for call decline or termination
    if (call.status === 'rejected') {
      cleanup();
      if (onCallRejected) onCallRejected();
      return;
    }
    if (call.status === 'ended') {
      cleanup();
      if (onCallEnded) onCallEnded();
      return;
    }

    // Set Remote Description from Answer
    if (call.answer && !isRemoteDescSet) {
      isRemoteDescSet = true;
      try {
        const answerDesc = new RTCSessionDescription(call.answer);
        await peerConnection.setRemoteDescription(answerDesc);
        stopRingtone();
        if (onCallActive) onCallActive();

        // Flush any queued answer candidates
        while (answerQueue.length > 0) {
          const cand = answerQueue.shift();
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Set remote description error on caller:', err);
      }
    }

    // Handle Receiver ICE candidates
    if (Array.isArray(call.answerCandidates)) {
      for (const cand of call.answerCandidates) {
        const key = `${cand.candidate}_${cand.sdpMid}_${cand.sdpMLineIndex}`;
        if (!seenAnswerCandidates.has(key)) {
          seenAnswerCandidates.add(key);
          if (isRemoteDescSet && peerConnection.remoteDescription) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding answer ICE candidate:', e);
            }
          } else {
            answerQueue.push(cand);
          }
        }
      }
    }
  });

  // Call timeout if unanswered after 45 seconds
  const timeoutId = setTimeout(async () => {
    if (!isRemoteDescSet) {
      try {
        await updateDoc(convRef, { 'activeCall.status': 'ended' });
      } catch (e) {}
      cleanup();
      if (onCallEnded) onCallEnded();
    }
  }, 45000);

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (batchTimeout) clearTimeout(batchTimeout);
    stopRingtone();
    unsub();
    localStream.getTracks().forEach((track) => track.stop());
    try {
      peerConnection.close();
    } catch (e) {}
  };

  const endCall = async () => {
    try {
      await updateDoc(convRef, { 'activeCall.status': 'ended' });
    } catch (e) {}
    cleanup();
  };

  return {
    callId,
    conversationId: convId,
    localStream,
    peerConnection,
    endCall
  };
}

/**
 * Answer an incoming WebRTC call.
 */
export async function answerCall({
  conversationId,
  call,
  onRemoteStream,
  onCallEnded
}) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  stopRingtone();

  const convId = conversationId || call.conversationId || getConversationId(call.callerId, call.receiverId);
  const convRef = doc(db, 'conversations', convId);

  // 1. Acquire local stream
  const localStream = await getLocalMediaStream(call.type);

  // 2. Initialize Peer Connection
  const peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Prepare transceiver for video if caller sent video but receiver has no camera
  if (call.type === 'video' && !localStream.getVideoTracks().length) {
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
  }

  // Persistent MediaStream accumulator for remote tracks
  const remoteStream = new MediaStream();

  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      event.streams[0].getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else if (event.track) {
      if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }
    if (onRemoteStream) onRemoteStream(remoteStream);
  };

  // Buffer and flush answer ICE candidates
  const earlyAnswerCandidates = [];
  let isAnswerSaved = false;
  const pendingAnswerBatch = [];
  let answerBatchTimeout = null;

  const flushAnswerBatch = () => {
    if (pendingAnswerBatch.length === 0) return;
    const toSend = [...pendingAnswerBatch];
    pendingAnswerBatch.length = 0;
    if (toSend.length > 0) {
      updateDoc(convRef, {
        'activeCall.answerCandidates': arrayUnion(...toSend)
      }).catch((err) => {
        console.warn('Error flushing answer candidates:', err);
      });
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candObj = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      };
      if (!isAnswerSaved) {
        earlyAnswerCandidates.push(candObj);
      } else {
        pendingAnswerBatch.push(candObj);
        if (!answerBatchTimeout) {
          answerBatchTimeout = setTimeout(() => {
            answerBatchTimeout = null;
            flushAnswerBatch();
          }, 300);
        }
      }
    }
  };

  // 3. Set remote Offer SDP
  await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));

  // Add any initial offer candidates sent by the caller
  const seenOfferCandidates = new Set();
  if (Array.isArray(call.offerCandidates)) {
    for (const cand of call.offerCandidates) {
      const key = `${cand.candidate}_${cand.sdpMid}_${cand.sdpMLineIndex}`;
      if (!seenOfferCandidates.has(key)) {
        seenOfferCandidates.add(key);
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {}
      }
    }
  }

  // 4. Create Answer SDP, set local description & wait briefly for ICE gathering
  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);
  await waitForIceGathering(peerConnection, 500);

  const localAnswer = peerConnection.localDescription || answerDescription;

  // 5. Update conversation with answer (never pass empty array to arrayUnion)
  const updatePayload = {
    'activeCall.status': 'active',
    'activeCall.answer': {
      type: localAnswer.type,
      sdp: localAnswer.sdp
    }
  };
  if (earlyAnswerCandidates.length > 0) {
    updatePayload['activeCall.answerCandidates'] = arrayUnion(...earlyAnswerCandidates);
  }

  await updateDoc(convRef, updatePayload);
  isAnswerSaved = true;

  if (pendingAnswerBatch.length > 0) {
    flushAnswerBatch();
  }

  // 6. Listen for ongoing offer candidates from caller & call end
  const unsub = onSnapshot(convRef, (snapshot) => {
    const data = snapshot.data();
    if (!data || !data.activeCall) return;
    const currentCall = data.activeCall;

    if (currentCall.status === 'ended' || currentCall.status === 'rejected') {
      cleanup();
      if (onCallEnded) onCallEnded();
      return;
    }

    if (Array.isArray(currentCall.offerCandidates)) {
      for (const cand of currentCall.offerCandidates) {
        const key = `${cand.candidate}_${cand.sdpMid}_${cand.sdpMLineIndex}`;
        if (!seenOfferCandidates.has(key)) {
          seenOfferCandidates.add(key);
          try {
            peerConnection.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
      }
    }
  });

  const cleanup = () => {
    if (answerBatchTimeout) clearTimeout(answerBatchTimeout);
    stopRingtone();
    unsub();
    localStream.getTracks().forEach((track) => track.stop());
    try {
      peerConnection.close();
    } catch (e) {}
  };

  const endCall = async () => {
    try {
      await updateDoc(convRef, { 'activeCall.status': 'ended' });
    } catch (e) {}
    cleanup();
  };

  return {
    callId: call.callId || convId,
    conversationId: convId,
    localStream,
    peerConnection,
    endCall
  };
}

/**
 * Reject incoming call
 */
export async function rejectIncomingCall(conversationId) {
  stopRingtone();
  if (!isFirebaseConfigured || !db || !conversationId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, { 'activeCall.status': 'rejected' });
  } catch (err) {
    console.warn('Error rejecting call:', err);
  }
}

/**
 * End an ongoing call
 */
export async function endCall(conversationId) {
  stopRingtone();
  if (!isFirebaseConfigured || !db || !conversationId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, { 'activeCall.status': 'ended' });
  } catch (err) {
    console.warn('Error ending call:', err);
  }
}

/**
 * Subscribe to incoming calls using the conversations collection.
 * This runs within standard Firestore security rules.
 */
export function subscribeToIncomingCalls(userId, onIncomingCall) {
  if (!isFirebaseConfigured || !db || !userId) return () => {};

  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      let incoming = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const call = data?.activeCall;
        if (
          call &&
          call.receiverId === userId &&
          call.status === 'calling' &&
          Date.now() - (call.createdAt || 0) < 90000
        ) {
          incoming = {
            ...call,
            conversationId: docSnap.id,
            id: call.callId || docSnap.id
          };
        }
      });
      onIncomingCall(incoming);
    },
    (err) => {
      console.warn('Error subscribing to incoming calls:', err);
    }
  );
}
