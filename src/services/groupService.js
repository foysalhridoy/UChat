import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

/**
 * Creates a new group conversation
 */
export async function createGroupConversation(creator, members, groupName) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured.');
  }

  const allUids = [creator.uid, ...members.map((m) => m.uid || m.id)];
  const uniqueUids = [...new Set(allUids)];

  if (uniqueUids.length < 2) {
    throw new Error('A group needs at least 2 members.');
  }

  const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const groupRef = doc(db, 'conversations', groupId);

  // Build participantData map
  const participantData = {};
  const participantMap = {};
  const unreadCounts = {};

  // Add creator
  participantData[creator.uid] = {
    uid: creator.uid,
    username: creator.username || creator.displayName || 'User',
    displayName: creator.displayName || creator.username || 'User',
    photoURL: creator.photoURL || ''
  };
  participantMap[creator.uid] = true;
  unreadCounts[creator.uid] = 0;

  // Add all members
  for (const member of members) {
    const uid = member.uid || member.id;
    participantData[uid] = {
      uid,
      username: member.username || member.displayName || 'User',
      displayName: member.displayName || member.username || 'User',
      photoURL: member.photoURL || ''
    };
    participantMap[uid] = true;
    unreadCounts[uid] = 0;
  }

  const newGroup = {
    id: groupId,
    isGroup: true,
    groupName: groupName.trim() || 'New Group',
    createdBy: creator.uid,
    participants: uniqueUids,
    participantMap,
    participantData,
    admins: [creator.uid],
    lastMessage: null,
    unreadCounts,
    typing: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(groupRef, newGroup);
  return { id: groupId, ...newGroup };
}

/**
 * Add a member to an existing group (admin only)
 */
export async function addGroupMember(groupId, adminUid, newMember) {
  if (!isFirebaseConfigured || !db) return;
  const groupRef = doc(db, 'conversations', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error('Group not found.');
  const data = snap.data();
  if (!data.admins?.includes(adminUid)) throw new Error('Only admins can add members.');

  const uid = newMember.uid || newMember.id;
  await updateDoc(groupRef, {
    participants: arrayUnion(uid),
    [`participantMap.${uid}`]: true,
    [`participantData.${uid}`]: {
      uid,
      username: newMember.username || 'User',
      displayName: newMember.displayName || newMember.username || 'User',
      photoURL: newMember.photoURL || ''
    },
    [`unreadCounts.${uid}`]: 0,
    updatedAt: serverTimestamp()
  });
}

/**
 * Remove a member from a group (admin only)
 */
export async function removeGroupMember(groupId, adminUid, targetUid) {
  if (!isFirebaseConfigured || !db) return;
  const groupRef = doc(db, 'conversations', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) throw new Error('Group not found.');
  const data = snap.data();
  if (!data.admins?.includes(adminUid)) throw new Error('Only admins can remove members.');
  if (targetUid === data.createdBy) throw new Error('Cannot remove the group creator.');

  await updateDoc(groupRef, {
    participants: arrayRemove(targetUid),
    [`participantMap.${targetUid}`]: false,
    updatedAt: serverTimestamp()
  });
}

/**
 * Leave a group (any member can leave)
 */
export async function leaveGroup(groupId, userId) {
  if (!isFirebaseConfigured || !db) return;
  const groupRef = doc(db, 'conversations', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const data = snap.data();

  const remainingParticipants = (data.participants || []).filter((uid) => uid !== userId);

  if (remainingParticipants.length === 0) {
    // Last person leaving — delete the group
    await deleteDoc(groupRef);
    return;
  }

  const updates = {
    participants: arrayRemove(userId),
    [`participantMap.${userId}`]: false,
    updatedAt: serverTimestamp()
  };

  // If the creator is leaving, transfer admin to next available participant
  if (data.createdBy === userId && remainingParticipants.length > 0) {
    const newAdmin = remainingParticipants[0];
    updates.admins = [newAdmin];
    updates.createdBy = newAdmin;
  }

  await updateDoc(groupRef, updates);
}

/**
 * Delete an entire group (creator/admin only)
 */
export async function deleteGroup(groupId, adminUid) {
  if (!isFirebaseConfigured || !db) return;
  const groupRef = doc(db, 'conversations', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const data = snap.data();
  if (!data.admins?.includes(adminUid)) throw new Error('Only admins can delete the group.');
  await deleteDoc(groupRef);
}
