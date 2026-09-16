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
    { urls: 'stun:stun4.l.google.com:19302' }
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
 * Acquire local audio/video media stream with resilient fallback
 */
export async function getLocalMediaStream(type = 'video') {
  const wantsVideo = type === 'video';

  if (wantsVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' }
      });
    } catch (err) {
      console.warn('Camera not accessible, falling back to audio-only stream:', err);
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
    }
  }

  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
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

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      stopRingtone();
      if (onRemoteStream) onRemoteStream(event.streams[0]);
    }
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
    updateDoc(convRef, {
      'activeCall.offerCandidates': arrayUnion(...toSend)
    }).catch((err) => {
      console.warn('Error flushing offer candidates:', err);
    });
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candObj = event.candidate.toJSON();
      if (!isDocInitialized) {
        earlyCandidates.push(candObj);
      } else {
        pendingBatch.push(candObj);
        if (!batchTimeout) {
          batchTimeout = setTimeout(() => {
            batchTimeout = null;
            flushCandidatesBatch();
          }, 250);
        }
      }
    }
  };

  // 3. Create Offer SDP
  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

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
      sdp: offerDescription.sdp || '',
      type: offerDescription.type || 'offer'
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

  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      if (onRemoteStream) onRemoteStream(event.streams[0]);
    }
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
    updateDoc(convRef, {
      'activeCall.answerCandidates': arrayUnion(...toSend)
    }).catch((err) => {
      console.warn('Error flushing answer candidates:', err);
    });
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candObj = event.candidate.toJSON();
      if (!isAnswerSaved) {
        earlyAnswerCandidates.push(candObj);
      } else {
        pendingAnswerBatch.push(candObj);
        if (!answerBatchTimeout) {
          answerBatchTimeout = setTimeout(() => {
            answerBatchTimeout = null;
            flushAnswerBatch();
          }, 250);
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

  // 4. Create Answer SDP & set local description
  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  // 5. Update conversation with answer and initial candidates
  await updateDoc(convRef, {
    'activeCall.status': 'active',
    'activeCall.answer': {
      type: answerDescription.type,
      sdp: answerDescription.sdp
    },
    'activeCall.answerCandidates': arrayUnion(...earlyAnswerCandidates)
  });
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
