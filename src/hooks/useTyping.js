import { useRef, useCallback, useEffect } from 'react';
import { setTypingState } from '../services/messageService';

export function useTyping(conversationId, userId) {
  const isTypingRef = useRef(false);
  const timerRef = useRef(null);
  const lastSentRef = useRef(0);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current && conversationId && userId) {
      isTypingRef.current = false;
      setTypingState(conversationId, userId, false);
    }
  }, [conversationId, userId]);

  const handleUserTyping = useCallback(() => {
    if (!conversationId || !userId) return;

    const now = Date.now();

    // Throttle writing "isTyping: true" to at most once every 2.5 seconds
    if (!isTypingRef.current || now - lastSentRef.current > 2500) {
      isTypingRef.current = true;
      lastSentRef.current = now;
      setTypingState(conversationId, userId, true);
    }

    // Reset auto-clear timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      stopTyping();
    }, 2500);
  }, [conversationId, userId, stopTyping]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  return { handleUserTyping, stopTyping };
}
