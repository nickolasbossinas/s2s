import type { Message } from '../../types/chat';
import styles from './Chat.module.css';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`${styles.bubble} ${styles[message.role]}`}>
      <p className={styles.bubbleText}>{message.content}</p>
    </div>
  );
}
