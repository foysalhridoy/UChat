import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { sanitizeUsername } from '../utils/validation';

/**
 * Fetch a single user profile document
 */
export async function getUserProfile(userId) {
  if (!isFirebaseConfigured || !db || !userId) return null;
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

/**
 * Real-time listener for a user profile
 */
export function subscribeUserProfile(userId, callback) {
  if (!isFirebaseConfigured || !db || !userId) {
    callback(null);
    return () => {};
  }
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  }, (err) => {
    console.error('Error in subscribeUserProfile:', err);
  });
}

/**
 * Search users by username or email prefix
 */
export async function searchUsers(rawQuery, currentUserId) {
  if (!isFirebaseConfigured || !db) return [];
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const usersRef = collection(db, 'users');
  const results = [];
  const seenIds = new Set();

  try {
    // 1. Search by username prefix
    const usernameQuery = query(
      usersRef,
      where('usernameLowercase', '>=', q),
      where('usernameLowercase', '<=', q + '\uf8ff'),
      limit(10)
    );

    const usernameSnap = await getDocs(usernameQuery);
    usernameSnap.forEach((docSnap) => {
      if (docSnap.id !== currentUserId && !seenIds.has(docSnap.id)) {
        seenIds.add(docSnap.id);
        results.push({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // 2. If results are few, also search by email
    if (results.length < 5 && q.includes('@')) {
      const emailQuery = query(
        usersRef,
        where('email', '==', q),
        limit(5)
      );
      const emailSnap = await getDocs(emailQuery);
      emailSnap.forEach((docSnap) => {
        if (docSnap.id !== currentUserId && !seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          results.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Update user profile details (displayName, photoURL)
 */
export async function updateUserProfile(userId, { displayName, photoURL }) {
  if (!isFirebaseConfigured || !db || !userId) return;
  const userRef = doc(db, 'users', userId);
  const updates = {};
  if (displayName !== undefined) updates.displayName = displayName.trim();
  if (photoURL !== undefined) updates.photoURL = photoURL;

  return await updateDoc(userRef, updates);
}

/**
 * Ensures user profile exists in Firestore (creates fallback profile if missing)
 */
export async function ensureUserProfile(user, fallbackUsername = '') {
  if (!isFirebaseConfigured || !db || !user?.uid) return null;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const cleanUsername = fallbackUsername || user.displayName || user.email?.split('@')[0] || `user_${user.uid.slice(0, 5)}`;
      const profileData = {
        uid: user.uid,
        username: cleanUsername,
        usernameLowercase: cleanUsername.toLowerCase(),
        displayName: user.displayName || cleanUsername,
        email: user.email || '',
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        status: 'online',
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      await setDoc(userRef, profileData, { merge: true });
      return profileData;
    }
    return snap.data();
  } catch (err) {
    console.warn('ensureUserProfile non-fatal warning:', err);
    return null;
  }
}

/**
 * Update user presence (online/offline)
 */
export async function setUserPresence(userId, status) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        status: status === 'online' ? 'online' : 'offline',
        lastSeen: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    // Non-critical, ignore if user is already logged out or connection dropped
  }
}
