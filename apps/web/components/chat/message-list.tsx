'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@clawteam/shared';
import { MessageBubble } from './message-bubble';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Send a message to start chatting
          </p>
        </div>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
