'use client';

import { ChatLayout } from '@/components/chat/chat-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { deleteChatSession } from '@/lib/actions';


export default function ChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/sessions`), orderBy('createdAt', 'asc'));
  }, [user, firestore]);

  const { data: sessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);

  const handleNewSession = async () => {
    if (!user || !firestore) return;

    // To prevent race conditions, fetch the current count directly
    const sessionsSnapshot = await getDocs(sessionsQuery!);
    const sessionCount = sessionsSnapshot.size;

    const newSessionRef = await addDoc(collection(firestore, `users/${user.uid}/sessions`), {
      createdAt: serverTimestamp(),
      name: `Session ${sessionCount + 1}`
    });
    setActiveSessionId(newSessionRef.id);
  };

  useEffect(() => {
    if (!sessionsLoading && user && firestore) {
      if (!sessions || sessions.length === 0) {
        // No sessions exist, create the first one.
        if (!activeSessionId) {
          handleNewSession();
        }
      } else {
        // Sessions exist.
        const sessionIds = sessions.map(s => s.id);
        if (activeSessionId === null || !sessionIds.includes(activeSessionId)) {
          // If no session is active or the active one was deleted, select the first available one.
          setActiveSessionId(sessions[0].id);
        }
      }
    }
  }, [sessions, sessionsLoading, user, firestore]);

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete || !user) return;

    const result = await deleteChatSession(user.uid, sessionToDelete);

    if (result.success) {
      toast({ title: "Session deleted", description: "The session and all its messages have been removed." });
    } else {
      toast({ title: "Error", description: result.message, variant: 'destructive' });
    }
    setSessionToDelete(null); // Close the dialog
  };

  return (
    <AlertDialog onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="h-full flex flex-col rounded-lg border">
            {activeSessionId ? (
                <ChatLayout sessionId={activeSessionId} key={activeSessionId} />
            ) : (
            <div className="flex items-center justify-center h-full">
                <p>Loading or creating session...</p>
            </div>
            )}
        </div>
        <div className="hidden lg:flex flex-col gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="h-6 w-6"/></AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-lg">Your AI Therapist</CardTitle>
                        <CardDescription>Here to listen and support you</CardDescription>
                    </div>
                </CardHeader>
            </Card>
            <Card className="flex-grow">
            <CardHeader>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>Start a new session or review a past one.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100%-10rem)]">
                <Button className="mb-4" onClick={handleNewSession}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Session
                </Button>
                <ScrollArea className="flex-grow">
                    <div className="flex flex-col gap-2">
                        {sessionsLoading ? <p>Loading sessions...</p> : sessions?.map((session) => (
                            <div key={session.id} className="flex items-center gap-2 group">
                                <Button 
                                    variant={activeSessionId === session.id ? 'secondary' : 'ghost'} 
                                    className="justify-start flex-grow w-0"
                                    onClick={() => selectSession(session.id)}
                                >
                                    <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{session.name || `Session ${session.id.substring(0, 4)}`}</span>
                                </Button>
                                <AlertDialogTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(session.id); }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
            </Card>
        </div>
        </div>
        <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this chat session and all of its messages.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
