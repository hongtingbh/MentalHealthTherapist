'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { detectSelfHarm } from '@/ai/flows/detect-potential-self-harm';
import { classifyMoodDisorders } from '@/ai/flows/classify-mood-disorders';
import { JournalEntry, Mood } from './definitions';
import { getSdks } from '@/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { getAuth } from 'firebase/auth';

const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
  userId: z.string().min(1, "User ID is required."),
});

function getDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const { firestore } = getSdks(app);
  return firestore;
}

export async function createJournalEntry(prevState: any, formData: FormData) {
  const validatedFields = NewEntrySchema.safeParse({
    content: formData.get('content'),
    mood: formData.get('mood'),
    userId: formData.get('userId'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create entry.',
    };
  }
  
  const { content, mood, userId } = validatedFields.data;

  try {
    const db = getDb();
    
    await addDoc(collection(db, "users", userId, "journalEntries"), {
        createdAt: serverTimestamp(),
        mood: mood as Mood,
        content,
        userId,
    });

    revalidatePath('/journal');
    revalidatePath('/dashboard');
    return { message: 'Journal entry created successfully.', success: true };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { message: `Error saving to database: ${errorMessage}` };
  }
}

export async function getJournalEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];
  try {
    const db = getDb();
    const entriesCollection = collection(db, "users", userId, "journalEntries");
    const q = query(entriesCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        return [];
    }

    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content,
        mood: data.mood,
        summary: data.content.substring(0, 100), // Use a snippet of content as summary
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        userId: data.userId,
      };
    });

    return entries as JournalEntry[];
  } catch (error) {
    console.error("Error fetching journal entries: ", error);
    return [];
  }
}

export async function postChatMessage(message: string, mediaDataUri?: string) {
  try {
    // 1. Check for self-harm
    const selfHarmCheck = await detectSelfHarm({ text: message });
    if (selfHarmCheck.selfHarmDetected) {
      return {
        role: 'assistant' as const,
        id: new Date().toISOString(),
        selfHarmWarning: selfHarmCheck.guidance,
        text: 'It sounds like you are going through a difficult time. Please consider reaching out for professional help.',
      };
    }

    // 2. Classify mood disorders
    const classification = await classifyMoodDisorders({ message, mediaDataUri });

    return {
      role: 'assistant' as const,
      id: new Date().toISOString(),
      text: classification.summary,
      classification: {
        ptsdSymptoms: classification.ptsdSymptoms,
        gadSymptoms: classification.gadSymptoms,
        mmdSymptoms: classification.mmdSymptoms,
        summary: classification.summary,
      },
    };
  } catch (error) {
    console.error('Error processing chat message:', error);
    return {
      role: 'assistant' as const,
      id: new Date().toISOString(),
      text: 'I apologize, but I encountered an error and cannot respond right now. Please try again later.',
    };
  }
}
