'use client';

import { ChatLayout } from '@/components/chat/chat-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, limit, getCountFromServer } from 'firebase/firestore';
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
  const isCreatingSession = useRef(false);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/sessions`), orderBy('createdAt', 'asc'));
  }, [user, firestore]);

  const { data: sessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);

  const handleNewSession = async () => {
    if (!user || !firestore || isCreatingSession.current) return;
    
    isCreatingSession.current = true;
    try {
        const sessionCountSnapshot = await getCountFromServer(sessionsQuery!);
        const sessionCount = sessionCountSnapshot.data().count;

        const newSessionRef = await addDoc(collection(firestore, `users/${user.uid}/sessions`), {
          createdAt: serverTimestamp(),
          name: `Session ${sessionCount + 1}`
        });
        setActiveSessionId(newSessionRef.id);
    } catch (error) {
        console.error("Failed to create new session:", error);
        toast({ title: 'Error', description: 'Could not create a new session.', variant: 'destructive' });
    } finally {
        isCreatingSession.current = false;
    }
  };

  useEffect(() => {
    // This effect runs when sessions are loaded or change.
    if (sessionsLoading || !user || !firestore) {
      // Still loading, do nothing.
      return;
    }

    if (sessions && sessions.length > 0) {
      // Sessions exist. Select the first one if none is active.
      if (activeSessionId === null) {
        setActiveSessionId(sessions[0].id);
      }
    } else if (sessions && sessions.length === 0) {
      // No sessions exist, create the first one.
      handleNewSession();
    }
  }, [sessions, sessionsLoading, user, firestore]);


  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete || !user) return;

    const result = await deleteChatSession(user.uid, sessionToDelete);

    if (result.success) {
      toast({ title: "Session deleted", description: "The session has been removed." });
       // If the deleted session was the active one, select another one
       if (activeSessionId === sessionToDelete) {
         const remainingSessions = sessions?.filter(s => s.id !== sessionToDelete);
         setActiveSessionId(remainingSessions && remainingSessions.length > 0 ? remainingSessions[0].id : null);
       }
    } else {
      toast({ title: "Error", description: result.message, variant: 'destructive' });
    }
    setSessionToDelete(null);
  };
  
  const canDelete = sessions ? sessions.length > 1 : false;

  return (
    <AlertDialog>
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
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Sessions</CardTitle>
                    <CardDescription>Start or review a session.</CardDescription>
                  </div>
                </div>
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
                                        className="h-8 w-8 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                                        disabled={!canDelete}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canDelete) {
                                                setSessionToDelete(session.id);
                                            }
                                        }}
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
          {sessionToDelete && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this chat session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSessionToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
    </AlertDialog>
  );
}
