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
  deleteField
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
