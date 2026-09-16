import React from 'react';
import { MessageSquareDashed } from 'lucide-react';

export function EmptyState({
  icon: Icon = MessageSquareDashed,
  title = 'No Conversations Yet',
  description = 'Start a conversation by finding a user or connecting with someone across the globe.',
  action
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
