'use client';

import { ChatLayout } from '@/components/chat/chat-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query } from 'firebase/firestore';

export default function ChatPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/sessions`));
  }, [user, firestore]);

  const { data: sessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);

  useEffect(() => {
    // If sessions are loaded and there's no active session, set the first one as active.
    // If there are no sessions, create one.
    if (!sessionsLoading) {
      if (sessions && sessions.length > 0) {
        if (!activeSessionId) {
          setActiveSessionId(sessions[0].id);
        }
      } else if (user && firestore) {
        handleNewSession();
      }
    }
  }, [sessions, sessionsLoading, activeSessionId, user, firestore]);


  const handleNewSession = async () => {
    if (!user || !firestore) return;
    const newSessionRef = await addDoc(collection(firestore, `users/${user.uid}/sessions`), {
      createdAt: serverTimestamp(),
      name: `Session ${sessions ? sessions.length + 1 : 1}`
    });
    setActiveSessionId(newSessionRef.id);
  };

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  return (
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
                        <Button 
                            key={session.id} 
                            variant={activeSessionId === session.id ? 'secondary' : 'ghost'} 
                            className="justify-start"
                            onClick={() => selectSession(session.id)}
                        >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            {session.name || `Session ${session.id.substring(0, 4)}`}
                        </Button>
                    ))}
                </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
