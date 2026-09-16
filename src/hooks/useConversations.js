import { useState, useEffect } from 'react';
import { subscribeConversations } from '../services/conversationService';

export function useConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeConversations(userId, (convList) => {
      setConversations(convList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { conversations, loading };
}
