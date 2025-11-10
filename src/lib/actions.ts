'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { detectSelfHarm } from '@/ai/flows/detect-potential-self-harm';
import { classifyMoodDisorders } from '@/ai/flows/classify-mood-disorders';
import { JournalEntry, Mood, ChatMessage } from './definitions';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
  userId: z.string().min(1, "User ID is required."),
});


// Helper function to initialize Firebase Admin SDK
function getAdminApp(): App {
    // If the app is already initialized, return it.
    if (getApps().length > 0) {
      return getApps()[0];
    }
  
    // Check for the service account environment variable.
    // This is set by Firebase App Hosting.
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountEnv) {
      try {
        const serviceAccount = JSON.parse(serviceAccountEnv);
        return initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (e) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
        // Fall through to try initializing without credentials for local dev
      }
    }
    
    // For local development, it will use GOOGLE_APPLICATION_CREDENTIALS
    // if that environment variable is set.
    return initializeApp();
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
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    
    await db.collection("users").doc(userId).collection("journalEntries").add({
        createdAt: FieldValue.serverTimestamp(),
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

export async function postChatMessage(userId: string, sessionId: string, message: string, mediaDataUri?: string): Promise<ChatMessage> {
  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const messagePath = `users/${userId}/sessions/${sessionId}/messages`;

    // 1. Save user message to Firestore
    const userMessage: Omit<ChatMessage, 'id' | 'classification' | 'selfHarmWarning'> = {
      role: 'user',
      text: message,
      ...(mediaDataUri && { mediaUrl: mediaDataUri }),
    };
    await db.collection(messagePath).add({
      ...userMessage,
      timestamp: FieldValue.serverTimestamp(),
      userId,
    });


    // 2. Check for self-harm
    const selfHarmCheck = await detectSelfHarm({ text: message });
    if (selfHarmCheck.selfHarmDetected) {
      const assistantMessage: ChatMessage = {
        role: 'assistant' as const,
        id: new Date().toISOString(),
        selfHarmWarning: selfHarmCheck.guidance,
        text: 'It sounds like you are going through a difficult time. Please consider reaching out for professional help.',
      };
      // Save assistant's warning message
      await db.collection(messagePath).add({
        ...assistantMessage,
        timestamp: FieldValue.serverTimestamp(),
        userId,
      });
      revalidatePath('/chat');
      return assistantMessage;
    }

    // 3. Classify mood disorders
    const classification = await classifyMoodDisorders({ message, mediaDataUri });

     const assistantResponse: ChatMessage = {
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

    // Save assistant's response
    await db.collection(messagePath).add({
        text: assistantResponse.text,
        role: 'assistant',
        classification: assistantResponse.classification,
        timestamp: FieldValue.serverTimestamp(),
        userId,
    });
    
    revalidatePath('/chat');
    return assistantResponse;

  } catch (error) {
    console.error('Error processing chat message:', error);
    return {
      role: 'assistant' as const,
      id: new Date().toISOString(),
      text: 'I apologize, but I encountered an error and cannot respond right now. Please try again later.',
    };
  }
}
