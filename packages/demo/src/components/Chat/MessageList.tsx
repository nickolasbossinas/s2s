import { useEffect, useRef } from 'react';
import type { Message } from '../../types/chat';
import MessageBubble from './MessageBubble';
import styles from './Chat.module.css';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.messageList}>
      {messages.length === 0 && (
        <p className={styles.emptyState}>Send a message to start chatting.</p>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
