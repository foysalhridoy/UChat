import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
  where,
  getDocs,
  getDoc,
  deleteField,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

/**
 * Real-time subscription to messages of a conversation
 */
export function subscribeMessages(conversationId, callback) {
  if (!isFirebaseConfigured || !db || !conversationId) {
    callback([]);
    return () => {};
  }

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => {
      messages.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(messages);
  }, (error) => {
    console.error('Error subscribing to messages:', error);
  });
}

/**
 * Send a message and update conversation meta.
 * For group messages pass groupParticipants (array of uids).
 */
export async function sendMessage(conversationId, senderId, receiverIdOrParticipants, text) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  const trimmedText = text.trim();
  if (!trimmedText) return;

  // Support both 1-to-1 (receiverId string) and group (participants array)
  const isGroup = Array.isArray(receiverIdOrParticipants);
  const receiverId = isGroup ? null : receiverIdOrParticipants;
  const groupParticipants = isGroup ? receiverIdOrParticipants : null;

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const convRef = doc(db, 'conversations', conversationId);

  // 1. Add message to subcollection
  const messageData = {
    senderId,
    receiverId: receiverId || '',
    text: trimmedText,
    type: 'text',
    createdAt: serverTimestamp(),
    seen: isGroup ? false : false,
    seenBy: [senderId]
  };

  const newMsgRef = await addDoc(messagesRef, messageData);

  // 2. Build unread count increments
  const unreadUpdates = {};
  if (isGroup && groupParticipants) {
    groupParticipants
      .filter((uid) => uid !== senderId)
      .forEach((uid) => {
        unreadUpdates[`unreadCounts.${uid}`] = increment(1);
      });
  } else if (receiverId) {
    unreadUpdates[`unreadCounts.${receiverId}`] = increment(1);
  }

  // 3. Update conversation header
  await updateDoc(convRef, {
    lastMessage: {
      text: trimmedText,
      senderId,
      createdAt: serverTimestamp(),
      seen: false
    },
    updatedAt: serverTimestamp(),
    [`typing.${senderId}`]: deleteField(),
    ...unreadUpdates
  });

  return newMsgRef.id;
}



/**
 * Mark all incoming messages in a conversation as seen
 */
export async function markMessagesAsSeen(conversationId, currentUserId) {
  if (!isFirebaseConfigured || !db || !conversationId || !currentUserId) return;

  try {
    const convRef = doc(db, 'conversations', conversationId);
    
    // 1. Reset unread count for current user
    await updateDoc(convRef, {
      [`unreadCounts.${currentUserId}`]: 0
    });

    // 2. Query messages not yet seen by current user
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const unseenQuery = query(
      messagesRef,
      where('seen', '==', false)
    );

    const snap = await getDocs(unseenQuery);
    if (!snap.empty) {
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.senderId !== currentUserId) {
          batch.update(docSnap.ref, { seen: true });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (error) {
    console.error('Error marking messages as seen:', error);
  }
}

/**
 * Update typing indicator status
 */
export async function setTypingState(conversationId, userId, isTyping) {
  if (!isFirebaseConfigured || !db || !conversationId || !userId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`typing.${userId}`]: isTyping ? serverTimestamp() : deleteField()
    });
  } catch (error) {
    // Non-fatal
  }
}

/**
 * Remove message for current user only ("Delete for me")
 */
export async function deleteMessageForMe(conversationId, messageId, userId) {
  if (!isFirebaseConfigured || !db || !conversationId || !messageId || !userId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  await updateDoc(msgRef, {
    deletedFor: arrayUnion(userId)
  });
}

/**
 * Revoke message for both users ("Delete for everyone")
 */
export async function deleteMessageForEveryone(conversationId, messageId, senderId) {
  if (!isFirebaseConfigured || !db || !conversationId || !messageId || !senderId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const convRef = doc(db, 'conversations', conversationId);

  // 1. Mark message as deleted for everyone and clear content
  await updateDoc(msgRef, {
    deletedForEveryone: true,
    text: '',
    reactions: {}
  });

  // 2. If this was the lastMessage in conversation, update summary
  try {
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const convData = convSnap.data();
      if (convData.lastMessage?.senderId === senderId) {
        await updateDoc(convRef, {
          'lastMessage.text': '🚫 This message was deleted',
          'lastMessage.deletedForEveryone': true
        });
      }
    }
  } catch (err) {
    console.warn('Could not update conversation lastMessage:', err);
  }
}

/**
 * Toggle an emoji reaction on a message (WhatsApp / Telegram style: 1 reaction per user)
 */
export async function toggleMessageReaction(conversationId, messageId, userId, emoji) {
  if (!isFirebaseConfigured || !db || !conversationId || !messageId || !userId || !emoji) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);

  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;

  const msgData = msgSnap.data();
  const currentReactions = { ...(msgData.reactions || {}) };

  const userList = currentReactions[emoji] || [];
  const hasReactedWithThisEmoji = userList.includes(userId);

  // Remove this user from all existing reactions on this message
  Object.keys(currentReactions).forEach((key) => {
    currentReactions[key] = (currentReactions[key] || []).filter((uid) => uid !== userId);
    if (currentReactions[key].length === 0) {
      delete currentReactions[key];
    }
  });

  // If user didn't already have this reaction, add it
  if (!hasReactedWithThisEmoji) {
    currentReactions[emoji] = [...(currentReactions[emoji] || []), userId];
  }

  await updateDoc(msgRef, {
    reactions: currentReactions
  });
}

/**
 * Log a completed, missed, or declined call into the conversation messages
 */
export async function logCallMessage(conversationId, {
  callId,
  callerId,
  receiverId,
  type = 'audio', // 'audio' | 'video'
  status = 'completed', // 'completed' | 'missed' | 'declined'
  duration = 0
}) {
  if (!isFirebaseConfigured || !db || !conversationId || !callerId) return;

  const msgId = callId ? `call_${callId}` : `call_${Date.now()}`;
  const msgDocRef = doc(db, 'conversations', conversationId, 'messages', msgId);
  const convRef = doc(db, 'conversations', conversationId);

  const isVideo = type === 'video';
  const prefix = isVideo ? '📹 Video call' : '📞 Voice call';
  let displayText = prefix;

  if (status === 'completed') {
    if (duration > 0) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      displayText = `${prefix} (${durStr})`;
    } else {
      displayText = `${prefix}`;
    }
  } else if (status === 'declined' || status === 'rejected') {
    displayText = isVideo ? '📹 Declined video call' : '📞 Declined voice call';
  } else {
    displayText = isVideo ? '📹 Missed video call' : '📞 Missed voice call';
  }

  const callRecord = {
    id: msgId,
    senderId: callerId,
    receiverId: receiverId || '',
    text: displayText,
    type: 'call',
    callData: {
      callId: callId || msgId,
      type,
      status,
      duration: duration || 0,
      callerId,
      receiverId: receiverId || ''
    },
    createdAt: serverTimestamp(),
    seen: false,
    seenBy: [callerId]
  };

  try {
    await setDoc(msgDocRef, callRecord, { merge: true });

    const updateData = {
      lastMessage: {
        text: displayText,
        senderId: callerId,
        createdAt: serverTimestamp(),
        seen: false
      },
      updatedAt: serverTimestamp()
    };

    if (status === 'missed' && receiverId) {
      updateData[`unreadCounts.${receiverId}`] = increment(1);
    }

    await updateDoc(convRef, updateData);
  } catch (err) {
    console.warn('Error logging call message:', err);
  }
}

