import type { SttLoadProgress } from '../../types/stt';
import styles from './Chat.module.css';

interface LoadingOverlayProps {
  progress: SttLoadProgress;
}

export default function LoadingOverlay({ progress }: LoadingOverlayProps) {
  return (
    <div className={styles.loadingOverlay}>
      <p className={styles.loadingTitle}>Downloading speech recognition model...</p>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
      </div>
      <p className={styles.loadingDetail}>{progress.detail}</p>
    </div>
  );
}
