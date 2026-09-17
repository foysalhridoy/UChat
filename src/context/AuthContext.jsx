import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthState, logoutUser } from '../services/authService';
import {
  subscribeUserProfile,
  setUserPresence,
  updateUserProfile,
  ensureUserProfile
} from '../services/userService';
import { isFirebaseConfigured } from '../services/firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthState((user) => {
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Subscribe to Firestore User Profile & Manage Presence
  useEffect(() => {
    if (!currentUser) return;

    // Ensure user profile document exists in Firestore and set online presence
    ensureUserProfile(currentUser).catch(() => {});
    setUserPresence(currentUser.uid, 'online');

    const unsubscribeProfile = subscribeUserProfile(currentUser.uid, (profile) => {
      setUserProfile(profile);
      setLoading(false);
    });

    // Heartbeat presence handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setUserPresence(currentUser.uid, 'online');
      } else {
        setUserPresence(currentUser.uid, 'offline');
      }
    };

    const handleBeforeUnload = () => {
      setUserPresence(currentUser.uid, 'offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribeProfile();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setUserPresence(currentUser.uid, 'offline');
    };
  }, [currentUser]);

  const handleLogout = async () => {
    if (currentUser) {
      await setUserPresence(currentUser.uid, 'offline');
    }
    await logoutUser();
  };

  const updateProfileData = async (data) => {
    if (!currentUser) return;
    await updateUserProfile(currentUser.uid, data);
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    isFirebaseConfigured,
    logout: handleLogout,
    updateProfileData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
