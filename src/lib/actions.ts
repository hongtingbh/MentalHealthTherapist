'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { summarizeJournalEntry } from '@/ai/flows/summarize-journal-entry';
import { detectSelfHarm } from '@/ai/flows/detect-potential-self-harm';
import { classifyMoodDisorders } from '@/ai/flows/classify-mood-disorders';
import { JournalEntry, Mood } from './definitions';
import { initializeFirebase } from './firebase';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';

const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
});

async function getDb() {
  const app = initializeFirebase();
  return getFirestore(app);
}

export async function createJournalEntry(prevState: any, formData: FormData) {
  const validatedFields = NewEntrySchema.safeParse({
    content: formData.get('content'),
    mood: formData.get('mood'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create entry.',
    };
  }
  
  const { content, mood } = validatedFields.data;

  try {
    const { summary } = await summarizeJournalEntry({ journalEntry: content });
    const db = await getDb();
    
    await addDoc(collection(db, "journalEntries"), {
        createdAt: serverTimestamp(),
        mood: mood as Mood,
        content,
        summary,
    });

    revalidatePath('/journal');
    revalidatePath('/dashboard');
    return { message: 'Journal entry created successfully.', success: true };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return { message: 'Error saving to database. Please try again.' };
  }
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  try {
    const db = await getDb();
    const entriesCollection = collection(db, "journalEntries");
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
        summary: data.summary,
        // Firestore Timestamps need to be converted to serializable format
        createdAt: data.createdAt.toDate().toISOString(),
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
