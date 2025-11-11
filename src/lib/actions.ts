'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { detectSelfHarm } from '@/ai/flows/detect-potential-self-harm';
import { classifyMoodDisorders } from '@/ai/flows/classify-mood-disorders';
import { JournalEntry, Mood, ChatMessage } from './definitions';

// ✅ Use Firestore client SDK for some ops, but Admin for mutations
import { getFirestore, collection, addDoc, serverTimestamp, } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import admin from 'firebase-admin';

// Helper to get the initialized Firebase Admin App
function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  // This automatically uses GOOGLE_APPLICATION_CREDENTIALS
  // on the server, which is the correct way for App Hosting.
  return admin.initializeApp();
}

// --------------------
// Journal entry schema
// --------------------
const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
  userId: z.string().min(1, 'User ID is required.'),
});

const DeleteEntrySchema = z.object({
    entryId: z.string().min(1, 'Entry ID is required.'),
    userId: z.string().min(1, 'User ID is required.'),
});


// --------------------
// Journal entry creation
// --------------------
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
    const adminDb = getAdminApp().firestore();
    await adminDb.collection(`users/${userId}/journalEntries`).add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      mood: mood as Mood,
      content,
      userId,
    });

    revalidatePath('/journal');
    revalidatePath('/dashboard');
    return { message: 'Journal entry created successfully.', success: true };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return { message: `Error saving to database: ${errorMessage}`, success: false };
  }
}

// --------------------
// Journal entry deletion
// --------------------
export async function deleteJournalEntry(userId: string, entryId: string): Promise<{ success: boolean; message?: string }> {
    const validatedFields = DeleteEntrySchema.safeParse({ userId, entryId });

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid IDs provided.' };
    }

    try {
        const adminDb = getAdminApp().firestore();
        const entryRef = adminDb.doc(`users/${userId}/journalEntries/${entryId}`);
        await entryRef.delete();

        revalidatePath('/journal');
        revalidatePath('/dashboard');
        return { success: true, message: 'Journal entry deleted.' };
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message };
    }
}


// --------------------
// Chat message posting
// --------------------
export async function postChatMessage(
  userId: string,
  sessionId: string,
  message: string,
  mediaDataUri?: string
): Promise<ChatMessage> {
  try {
    const adminDb = getAdminApp().firestore();
    const messagePath = `users/${userId}/sessions/${sessionId}/messages`;

    const userMessageData = {
      role: 'user',
      text: message,
      ...(mediaDataUri && { mediaUrl: mediaDataUri }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId,
    };
    await adminDb.collection(messagePath).add(userMessageData);

    const selfHarmCheck = await detectSelfHarm({ text: message });
    if (selfHarmCheck.selfHarmDetected) {
      const assistantMessage: ChatMessage = {
        role: 'assistant' as const,
        id: new Date().toISOString(),
        selfHarmWarning: selfHarmCheck.guidance,
        text:
          'It sounds like you are going through a difficult time. Please consider reaching out for professional help.',
      };
      await adminDb.collection(messagePath).add({
        ...assistantMessage,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
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

    await adminDb.collection(messagePath).add({
      text: assistantResponse.text,
      role: 'assistant',
      classification: assistantResponse.classification,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId,
    });

    revalidatePath('/chat');
    return assistantResponse;
  } catch (error) {
    console.error('Error processing chat message:', error);
    return {
      role: 'assistant' as const,
      id: new Date().toISOString(),
      text:
        'I apologize, but I encountered an error and cannot respond right now. Please try again later.',
    };
  }
}

// --------------------
// Delete one session
// --------------------
export async function deleteChatSession(
  userId: string,
  sessionId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const adminDb = getAdminApp().firestore();
    const sessionRef = adminDb.doc(`users/${userId}/sessions/${sessionId}`);
    
    // Use a batch to delete the session and its messages subcollection
    const batch = adminDb.batch();
    
    const messagesSnapshot = await adminDb.collection(`users/${userId}/sessions/${sessionId}/messages`).get();
    if (!messagesSnapshot.empty) {
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    batch.delete(sessionRef);
    await batch.commit();
    
    revalidatePath('/chat');
    return { success: true };
  } catch (error) {
    console.error('Error deleting chat session:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message };
  }
}
