import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type { SttStatus, SttLoadProgress } from '../../types/stt';
import MicButton from './MicButton';
import styles from './Chat.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  sttText: string;
  onSttTextConsumed: () => void;
  sttPartial: string;
  sttStatus: SttStatus;
  sttLoadProgress: SttLoadProgress | null;
  onMicToggle: () => void;
}

export default function ChatInput({
  onSend,
  disabled,
  sttText,
  onSttTextConsumed,
  sttPartial,
  sttStatus,
  onMicToggle,
}: ChatInputProps) {
  const [text, setText] = useState('');

  // When STT finalizes text, append it to the input
  const stableOnSttTextConsumed = useCallback(onSttTextConsumed, [onSttTextConsumed]);
  useEffect(() => {
    if (sttText) {
      setText((prev) => {
        const sep = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + sep + sttText;
      });
      stableOnSttTextConsumed();
    }
  }, [sttText, stableOnSttTextConsumed]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div>
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <MicButton status={sttStatus} onClick={onMicToggle} />
        <button className={styles.sendButton} type="submit" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
      {sttStatus === 'recording' && sttPartial && (
        <div className={styles.partialText}>Hearing: {sttPartial}</div>
      )}
      {sttStatus === 'error' && (
        <div className={styles.sttError}>Mic error — click mic to retry</div>
      )}
    </div>
  );
}
