export type ChatRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
}
