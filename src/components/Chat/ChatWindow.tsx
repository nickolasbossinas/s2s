import { useState } from 'react';
import type { Message } from '../../types/chat';
import { sendMessage } from '../../services/llm';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import styles from './Chat.module.css';

let nextId = 0;
function createMessage(role: Message['role'], content: string): Message {
  return { id: String(nextId++), role, content, timestamp: Date.now() };
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (text: string) => {
    const userMsg = createMessage('user', text);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const reply = await sendMessage(text);
      const assistantMsg = createMessage('assistant', reply);
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.chatWindow}>
      <MessageList messages={messages} />
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
