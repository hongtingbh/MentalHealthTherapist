export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export const MOODS = ['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious'] as const;
export type Mood = (typeof MOODS)[number];

export type JournalEntry = {
  id: string;
  createdAt: string;
  mood: Mood;
  content: string;
  summary: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mediaUrl?: string; // for displaying on the client
  mediaMimeType?: string; // for displaying on the client
  classification?: {
    ptsdSymptoms: string[];
    gadSymptoms: string[];
    mmdSymptoms: string[];
    summary: string;
  };
  selfHarmWarning?: string;
};

export type MoodDataItem = {
  mood: Mood;
  count: number;
};
