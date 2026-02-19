import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import type { SttStatus } from '../../types/stt';
import MicButton from './MicButton';
import styles from './Chat.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  sttText: string;
  onSttTextConsumed: () => void;
  sttPartial: string;
  sttStatus: SttStatus;
  onMicToggle: () => void;
  voiceGender: 'female' | 'male';
  onVoiceGenderToggle: () => void;
}

export default function ChatInput({
  onSend,
  disabled,
  sttText,
  onSttTextConsumed,
  sttPartial,
  sttStatus,
  onMicToggle,
  voiceGender,
  onVoiceGenderToggle,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [autoSend, setAutoSend] = useState(true);
  const textRef = useRef('');
  textRef.current = text;

  // When STT finalizes text, append it to the input (or auto-send)
  const stableOnSttTextConsumed = useCallback(onSttTextConsumed, [onSttTextConsumed]);
  useEffect(() => {
    if (!sttText) return;

    if (autoSend && !disabled) {
      // Auto-send: combine any existing text with the new STT text and send directly
      const existing = textRef.current.trim();
      const sep = existing ? ' ' : '';
      const toSend = (existing + sep + sttText).trim();
      if (toSend) {
        setText('');
        onSend(toSend);
      }
    } else {
      setText((prev) => {
        const sep = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + sep + sttText;
      });
    }
    stableOnSttTextConsumed();
  }, [sttText, stableOnSttTextConsumed, autoSend, disabled, onSend]);

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
        <div className={styles.inputWrapper}>
          <input
            className={styles.input}
            type="text"
            placeholder={sttStatus === 'recording' && sttPartial ? '' : 'Type a message...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
          />
          {sttStatus === 'recording' && sttPartial && (
            <div className={styles.partialOverlay} aria-hidden="true">
              <span className={styles.partialHidden}>{text}{text && !text.endsWith(' ') ? ' ' : ''}</span>
              <span className={styles.partialGhost}>{sttPartial}</span>
            </div>
          )}
          <button
            className={`${styles.autoSendToggle} ${autoSend ? styles.autoSendActive : ''}`}
            type="button"
            onClick={() => setAutoSend((prev) => !prev)}
            aria-label={autoSend ? 'Disable auto-send' : 'Enable auto-send'}
            title={autoSend ? 'Auto-send: ON — speech is sent automatically' : 'Auto-send: OFF — speech goes to input for review'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
            </svg>
          </button>
        </div>
        <MicButton status={sttStatus} onClick={onMicToggle} />
        <button
          className={styles.voiceToggle}
          type="button"
          onClick={onVoiceGenderToggle}
          aria-label={`Voice: ${voiceGender}`}
          title={`Voice: ${voiceGender} — click to switch`}
        >
          {voiceGender === 'female' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="5" />
              <path d="M12 13v8" />
              <path d="M9 18h6" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="6" />
              <path d="M14.5 5.5 20 0" />
              <path d="M15 0h5v5" />
            </svg>
          )}
        </button>
        <button className={styles.sendButton} type="submit" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
      {sttStatus === 'error' && (
        <div className={styles.sttError}>Mic error — click mic to retry</div>
      )}
    </div>
  );
}
