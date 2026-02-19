import ChatWindow from './components/Chat/ChatWindow';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>S2S Voice Chat</h1>
      </header>
      <main className={styles.main}>
        <ChatWindow />
      </main>
    </div>
  );
}
