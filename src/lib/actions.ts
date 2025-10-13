'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { summarizeJournalEntry } from '@/ai/flows/summarize-journal-entry';
import { detectSelfHarm } from '@/ai/flows/detect-potential-self-harm';
import { classifyMoodDisorders } from '@/ai/flows/classify-mood-disorders';
import { JournalEntry, Mood } from './definitions';

// This is a mock database. In a real application, you would use a database
// like Firestore, PostgreSQL, etc.
const journalEntries: JournalEntry[] = [];
let journalIdCounter = 1;

const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
});

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

    const newEntry: JournalEntry = {
      id: (journalIdCounter++).toString(),
      createdAt: new Date().toISOString(),
      mood: mood as Mood,
      content,
      summary,
    };

    journalEntries.unshift(newEntry); // Add to the beginning of the array

    revalidatePath('/journal');
    revalidatePath('/dashboard');
    return { message: 'Journal entry created successfully.', success: true };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return { message: 'Error processing AI summary. Please try again.' };
  }
}

export async function getJournalEntries() {
  // In a real app, you'd fetch this from a database
  return Promise.resolve(journalEntries);
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
