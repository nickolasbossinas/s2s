import type { SttStatus } from '../../types/stt';
import styles from './Chat.module.css';

interface MicButtonProps {
  status: SttStatus;
  onClick: () => void;
}

export default function MicButton({ status, onClick }: MicButtonProps) {
  const isRecording = status === 'recording';
  const isNotReady = status === 'idle' || status === 'loading';

  return (
    <button
      className={`${styles.micButton} ${isRecording ? styles.micButtonRecording : ''}`}
      onClick={onClick}
      disabled={isNotReady}
      type="button"
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      title={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isNotReady ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10">
            <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      )}
    </button>
  );
}
