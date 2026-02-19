import { useState, type FormEvent } from 'react';
import styles from './Chat.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form className={styles.inputBar} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <button className={styles.sendButton} type="submit" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  );
}
