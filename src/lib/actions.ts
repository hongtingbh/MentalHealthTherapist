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
    if (getApps().length > 0) {
      return getApps()[0];
    }
  
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountEnv) {
      try {
        const serviceAccount = JSON.parse(serviceAccountEnv);
        return initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (e) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e);
        // Fall through for local dev
      }
    }
    
    // For local development with GOOGLE_APPLICATION_CREDENTIALS
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
      success: false,
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
    return { message: `Error saving to database: ${errorMessage}`, success: false };
  }
}

export async function postChatMessage(userId: string, sessionId: string, message: string, mediaDataUri?: string): Promise<ChatMessage> {
  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const messagePath = `users/${userId}/sessions/${sessionId}/messages`;

    const userMessageData = {
      role: 'user',
      text: message,
      ...(mediaDataUri && { mediaUrl: mediaDataUri }),
      timestamp: FieldValue.serverTimestamp(),
      userId,
    };
    await db.collection(messagePath).add(userMessageData);

    const selfHarmCheck = await detectSelfHarm({ text: message });
    if (selfHarmCheck.selfHarmDetected) {
      const assistantMessage: ChatMessage = {
        role: 'assistant' as const,
        id: new Date().toISOString(),
        selfHarmWarning: selfHarmCheck.guidance,
        text: 'It sounds like you are going through a difficult time. Please consider reaching out for professional help.',
      };
      await db.collection(messagePath).add({
        ...assistantMessage,
        timestamp: FieldValue.serverTimestamp(),
        userId,
      });
      revalidatePath('/chat');
      return assistantMessage;
    }

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

export async function deleteChatSession(userId: string, sessionId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);

    const sessionRef = db.collection('users').doc(userId).collection('sessions').doc(sessionId);
    const messagesRef = sessionRef.collection('messages');

    // Delete all messages in the subcollection
    const messagesSnapshot = await messagesRef.get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete the session document itself
    await sessionRef.delete();

    revalidatePath('/chat');
    return { success: true };
  } catch (error) {
    console.error('Error deleting chat session:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message };
  }
}
