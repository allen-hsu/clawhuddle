import type { ChatMessage } from '@clawteam/shared';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
        style={
          isUser
            ? {
                background: 'var(--accent)',
                color: 'var(--text-inverse)',
              }
            : {
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
              }
        }
      >
        {message.content}
      </div>
    </div>
  );
}
