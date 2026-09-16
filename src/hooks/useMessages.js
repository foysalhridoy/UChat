import { useState, useEffect } from 'react';
import { subscribeMessages, markMessagesAsSeen } from '../services/messageService';

export function useMessages(conversationId, currentUserId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeMessages(conversationId, (msgList) => {
      setMessages(msgList);
      setLoading(false);

      // Auto-mark as seen if there are unread messages not sent by current user
      if (currentUserId && msgList.length > 0) {
        const hasUnseen = msgList.some(m => m.senderId !== currentUserId && !m.seen);
        if (hasUnseen) {
          markMessagesAsSeen(conversationId, currentUserId);
        }
      }
    });

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  return { messages, loading };
}
