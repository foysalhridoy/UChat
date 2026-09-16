import {
  collection,
  doc,
  addDoc,
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
 * Send a message and update conversation meta
 */
export async function sendMessage(conversationId, senderId, receiverId, text) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  const trimmedText = text.trim();
  if (!trimmedText) return;

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const convRef = doc(db, 'conversations', conversationId);

  // 1. Add message to subcollection
  const messageData = {
    senderId,
    receiverId,
    text: trimmedText,
    type: 'text',
    createdAt: serverTimestamp(),
    seen: false,
    seenBy: [senderId]
  };

  const newMsgRef = await addDoc(messagesRef, messageData);

  // 2. Update conversation header
  await updateDoc(convRef, {
    lastMessage: {
      text: trimmedText,
      senderId,
      createdAt: serverTimestamp(),
      seen: false
    },
    updatedAt: serverTimestamp(),
    [`unreadCounts.${receiverId}`]: increment(1),
    [`typing.${senderId}`]: deleteField() // clear typing state on send
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
