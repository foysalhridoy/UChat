import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { isValidEmail, isValidUsername, validatePassword, sanitizeUsername } from '../utils/validation';

/**
 * Maps raw Firebase auth errors to user-friendly messages
 */
export function getFriendlyErrorMessage(error) {
  if (!error) return 'An unexpected error occurred';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase console.';
    case 'auth/weak-password':
      return 'The password is too weak. Must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet.';
    default:
      return error.message || 'An error occurred during authentication.';
  }
}

/**
 * Checks if a username is available
 */
export async function checkUsernameAvailability(username) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured. Please add your credentials.');
  }

  const clean = sanitizeUsername(username);
  if (!isValidUsername(clean)) {
    return { available: false, error: 'Username must be 3-20 letters, numbers, or underscores' };
  }

  try {
    const usernameDocRef = doc(db, 'usernames', clean);
    const snap = await getDoc(usernameDocRef);
    return { available: !snap.exists(), clean };
  } catch (err) {
    console.error('Error checking username:', err);
    throw err;
  }
}

/**
 * Register a new user with email, password, and unique username
 */
export async function registerUser({ email, password, username, displayName }) {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error('Firebase is not configured. Please set your credentials in .env.');
  }

  if (!isValidEmail(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  const cleanUsername = sanitizeUsername(username);
  if (!isValidUsername(cleanUsername)) {
    throw new Error('Username must be 3-20 characters long (letters, numbers, underscores).');
  }

  const resolvedDisplayName = (displayName && displayName.trim()) || username;

  // Verify username availability and claim atomically via transaction
  const usernameRef = doc(db, 'usernames', cleanUsername);

  // 1. Create auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  try {
    // 2. Update Auth display name
    await updateProfile(user, {
      displayName: resolvedDisplayName
    });

    // 3. Atomically reserve username and create user document
    await runTransaction(db, async (transaction) => {
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists()) {
        throw new Error('Username has just been taken by another user.');
      }

      // Claim username
      transaction.set(usernameRef, {
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      // Write user profile
      const userDocRef = doc(db, 'users', user.uid);
      transaction.set(userDocRef, {
        uid: user.uid,
        username: username.trim(),
        usernameLowercase: cleanUsername,
        displayName: resolvedDisplayName,
        email: email.trim().toLowerCase(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        status: 'online',
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    });

    return user;
  } catch (error) {
    // If firestore write fails, cleanup auth user to prevent orphaned account
    console.error('Registration Firestore transaction failed:', error);
    try {
      await user.delete();
    } catch {
      // ignore deletion error
    }
    throw error;
  }
}

/**
 * Log in an existing user
 */
export async function loginUser(email, password) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase is not configured. Please add your credentials.');
  }
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }
  return await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Log out the current user
 */
export async function logoutUser() {
  if (!auth) return;
  return await signOut(auth);
}

/**
 * Listen to auth state changes
 */
export function onAuthState(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
