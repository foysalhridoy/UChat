import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

/**
 * Generates a deterministic ID for a 1-to-1 conversation
 */
export function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

/**
 * Gets or creates a conversation between two users
 */
export async function getOrCreateConversation(currentUser, targetUser) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  const currentUid = currentUser.uid || currentUser.id;
  const targetUid = targetUser.uid || targetUser.id;

  if (currentUid === targetUid) {
    throw new Error('You cannot start a conversation with yourself.');
  }

  const convId = getConversationId(currentUid, targetUid);
  const convRef = doc(db, 'conversations', convId);
  const convSnap = await getDoc(convRef);

  if (convSnap.exists()) {
    return { id: convSnap.id, ...convSnap.data() };
  }

  // Create new conversation
  const newConvData = {
    id: convId,
    participants: [currentUid, targetUid],
    participantMap: {
      [currentUid]: true,
      [targetUid]: true
    },
    participantData: {
      [currentUid]: {
        uid: currentUid,
        username: currentUser.username || currentUser.displayName || 'User',
        displayName: currentUser.displayName || currentUser.username || 'User',
        photoURL: currentUser.photoURL || ''
      },
      [targetUid]: {
        uid: targetUid,
        username: targetUser.username || targetUser.displayName || 'User',
        displayName: targetUser.displayName || targetUser.username || 'User',
        photoURL: targetUser.photoURL || ''
      }
    },
    lastMessage: null,
    unreadCounts: {
      [currentUid]: 0,
      [targetUid]: 0
    },
    typing: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(convRef, newConvData);
  return { id: convId, ...newConvData };
}

/**
 * Listen to all conversations the current user is part of
 */
export function subscribeConversations(userId, callback) {
  if (!isFirebaseConfigured || !db || !userId) {
    callback([]);
    return () => {};
  }

  const convsRef = collection(db, 'conversations');
  const q = query(
    convsRef,
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort by updatedAt descending (client-side sort prevents requiring composite index)
    list.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
      return timeB - timeA;
    });

    callback(list);
  }, (error) => {
    console.error('Error subscribing to conversations:', error);
  });
}

/**
 * Reset unread message count for a user in a conversation
 */
export async function resetUnreadCount(conversationId, userId) {
  if (!isFirebaseConfigured || !db || !conversationId || !userId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`unreadCounts.${userId}`]: 0
    });
  } catch (err) {
    console.error('Error resetting unread count:', err);
  }
}
