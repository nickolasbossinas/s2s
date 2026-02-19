import { useState, useCallback } from 'react';
import type { Message } from '../../types/chat';
import { sendMessage } from '../../services/llm';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import LoadingOverlay from './LoadingOverlay';
import styles from './Chat.module.css';

let nextId = 0;
function createMessage(role: Message['role'], content: string): Message {
  return { id: String(nextId++), role, content, timestamp: Date.now() };
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    status: sttStatus,
    partialText,
    finalText,
    loadProgress,
    toggleRecording,
    clearText,
  } = useSpeechToText();

  const handleSend = async (text: string) => {
    clearText();
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

  const handleSttTextConsumed = useCallback(() => {
    clearText();
  }, [clearText]);

  return (
    <div className={styles.chatWindow}>
      {sttStatus === 'loading' && loadProgress && (
        <LoadingOverlay progress={loadProgress} />
      )}
      <MessageList messages={messages} />
      <ChatInput
        onSend={handleSend}
        disabled={loading}
        sttText={finalText}
        onSttTextConsumed={handleSttTextConsumed}
        sttPartial={partialText}
        sttStatus={sttStatus}
        sttLoadProgress={loadProgress}
        onMicToggle={toggleRecording}
      />
    </div>
  );
}
