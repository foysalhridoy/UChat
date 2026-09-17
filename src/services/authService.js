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

export const USERNAME_DOMAIN = 'uchat.local';

/**
 * Converts a clean username to an internal auth email
 */
export function usernameToEmail(cleanUsername) {
  return `${cleanUsername}@${USERNAME_DOMAIN}`;
}

/**
 * Maps raw Firebase auth errors to user-friendly messages
 */
export function getFriendlyErrorMessage(error) {
  if (!error) return 'An unexpected error occurred';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This username is already taken. Please choose another.';
    case 'auth/invalid-email':
      return 'Please enter a valid username or email.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase console.';
    case 'auth/weak-password':
      return 'The password is too weak. Must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid username/email or password. Please try again.';
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
 * Register a new user with unique username and password (no email required)
 */
export async function registerUser({ username, password, displayName, email }) {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error('Firebase is not configured. Please set your credentials in .env.');
  }

  const cleanUsername = sanitizeUsername(username);
  if (!isValidUsername(cleanUsername)) {
    throw new Error('Username must be 3-20 characters long (letters, numbers, underscores).');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  // Pre-check username availability in Firestore
  const availability = await checkUsernameAvailability(cleanUsername);
  if (!availability.available) {
    throw new Error('This username is already taken. Please choose another.');
  }

  // If user provided a real email, validate and use it; otherwise generate internal unique email from username
  const authEmail = email && isValidEmail(email)
    ? email.trim().toLowerCase()
    : usernameToEmail(cleanUsername);

  const resolvedDisplayName = (displayName && displayName.trim()) || username.trim();

  // Verify username availability and claim atomically via transaction
  const usernameRef = doc(db, 'usernames', cleanUsername);

  // 1. Create auth user
  const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
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
        username: cleanUsername,
        email: authEmail,
        createdAt: serverTimestamp()
      });

      // Write user profile
      const userDocRef = doc(db, 'users', user.uid);
      transaction.set(userDocRef, {
        uid: user.uid,
        username: username.trim(),
        usernameLowercase: cleanUsername,
        displayName: resolvedDisplayName,
        email: authEmail,
        isUsernameOnly: !email,
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
 * Log in an existing user with username or email + password
 */
export async function loginUser(identifier, password) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase is not configured. Please add your credentials.');
  }
  if (!identifier || !identifier.trim() || !password) {
    throw new Error('Username and password are required.');
  }

  const raw = identifier.trim();
  let resolvedEmail = raw;

  // If the user typed an email, use it directly
  if (raw.includes('@')) {
    resolvedEmail = raw.toLowerCase();
  } else {
    // It's a username! Look up if there is an explicit email in 'usernames' collection
    const clean = sanitizeUsername(raw);
    resolvedEmail = usernameToEmail(clean);

    if (db) {
      try {
        const usernameDocRef = doc(db, 'usernames', clean);
        const snap = await getDoc(usernameDocRef);
        if (snap.exists() && snap.data()?.email) {
          resolvedEmail = snap.data().email;
        }
      } catch (e) {
        // If lookup fails (e.g. network/rules), fallback to default usernameToEmail
        console.warn('Username email lookup fallback:', e);
      }
    }
  }

  return await signInWithEmailAndPassword(auth, resolvedEmail, password);
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
