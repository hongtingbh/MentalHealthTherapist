'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { JournalEntry, Mood, ChatMessage } from './definitions';
import admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import * as fs from 'fs';

// Helper to get the initialized Firebase Admin App
function getAdminApp() {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    // This is the recommended way to use initializeApp with App Hosting.
    // It automatically uses Application Default Credentials.
    try {
        return admin.initializeApp();
    } catch (e) {
        // If the above fails (e.g., in a local environment without ADC setup),
        // we can fall back to using a service account file.
        console.warn('Default admin.initializeApp() failed, falling back to service account key. Error:', e);
        
        const serviceAccountPath = './service-account.json';
        if (fs.existsSync(serviceAccountPath)) {
            return admin.initializeApp({
                credential: credential.cert(serviceAccountPath),
            });
        } else {
            // This will likely cause subsequent operations to fail, but it prevents an immediate crash.
            // The errors will be more specific to the Firestore/Auth operation failing.
            console.error(`Fallback service account file not found at ${serviceAccountPath}. Admin SDK might not work correctly.`);
            // Continue without full initialization. Firebase services will throw errors when used.
            return admin.initializeApp({}, 'fallback-app-placeholder'); // Use a named app to avoid conflicts
        }
    }
}

// --------------------
// Journal entry schema
// --------------------
const NewEntrySchema = z.object({
  content: z.string().min(1, 'Journal entry cannot be empty.'),
  mood: z.enum(['Happy', 'Calm', 'Neutral', 'Sad', 'Anxious']),
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
  mediaUrl: string,
  mediaMimeType: string,
): Promise<{ success: boolean; message?: string } > {
  try {
    const adminDb = getAdminApp().firestore();
    const messagePath = `users/${userId}/sessions/${sessionId}/messages`;

    const userMessageData = {
      role: 'user' as const,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId,
      mediaUrl: mediaUrl,
      mediaMimeType: mediaMimeType
    };
    
    // Write user message to Firestore
    await adminDb.collection(messagePath).add(userMessageData);
    
    // Simulate assistant response
    const assistantResponse: ChatMessage = {
      role: 'assistant' as const,
      id: new Date().toISOString(),
      text: "Thank you for sharing. I'm here to listen.",
    };

    // Write assistant message to Firestore
    await adminDb.collection(messagePath).add({
      text: assistantResponse.text,
      role: 'assistant',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId,
    });

    revalidatePath('/chat');
    return { success: true };
    
  } catch (error) {
    console.error('Error processing chat message:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message };
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
    
    const messagesSnapshot = await adminDb.collection(`users/${userId}/sessions/${sessionId}/messages`).get();
    
    const batch = adminDb.batch();
    
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


// --------------------
// Rename a session
// --------------------
export async function renameChatSession(
  userId: string,
  sessionId: string,
  newName: string
): Promise<{ success: boolean; message?: string }> {
  const schema = z.string().min(1, "Name cannot be empty").max(50, "Name is too long");
  const validation = schema.safeParse(newName);

  if (!validation.success) {
    return { success: false, message: validation.error.errors[0].message };
  }
  
  try {
    const adminDb = getAdminApp().firestore();
    const sessionRef = adminDb.doc(`users/${userId}/sessions/${sessionId}`);
    await sessionRef.update({ name: newName });
    revalidatePath('/chat');
    return { success: true };
  } catch (error) {
    console.error('Error renaming chat session:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message };
  }
}
