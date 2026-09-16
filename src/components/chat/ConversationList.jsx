import React from 'react';
import { ConversationItem } from './ConversationItem';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { MessageSquarePlus } from 'lucide-react';

export function ConversationList({
  conversations,
  currentUserId,
  activeConversationId,
  onSelectConversation,
  searchQuery,
  loading,
  onOpenSearch
}) {
  if (loading) {
    return <LoadingSpinner text="Loading conversations..." />;
  }

  // Filter conversations by search term
  const filtered = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const otherUid = conv.participants?.find(uid => uid !== currentUserId);
    const data = conv.participantData?.[otherUid];
    const name = (data?.displayName || '').toLowerCase();
    const username = (data?.username || '').toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  if (filtered.length === 0) {
    return (
      <EmptyState
        title={searchQuery ? 'No matching chats' : 'No conversations yet'}
        description={
          searchQuery
            ? `No active chats match "${searchQuery}". Try searching for users instead.`
            : 'Find users and start connecting across borders.'
        }
        action={
          <button
            onClick={onOpenSearch}
            className="btn btn-primary"
            style={{ marginTop: 8 }}
          >
            <MessageSquarePlus size={18} />
            <span>Find People</span>
          </button>
        }
      />
    );
  }

  return (
    <div className="conversations-container">
      <div className="conversations-list" role="list">
        {filtered.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            currentUserId={currentUserId}
            isActive={conv.id === activeConversationId}
            onSelect={() => onSelectConversation(conv)}
          />
        ))}
      </div>
    </div>
  );
}
