'use client';

import { ChatLayout } from '@/components/chat/chat-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function ChatPage() {
  const [sessions, setSessions] = useState(['Session 1']);
  const [activeSession, setActiveSession] = useState('Session 1');
  const [conversationId, setConversationId] = useState('Session 1');

  const handleNewSession = () => {
    const newSessionNumber = sessions.length + 1;
    const newSessionName = `Session ${newSessionNumber}`;
    setSessions([...sessions, newSessionName]);
    setActiveSession(newSessionName);
    setConversationId(newSessionName); // Change conversation ID to reset chat
  };

  const selectSession = (session: string) => {
    setActiveSession(session);
    setConversationId(session); // Change conversation ID to reset chat
  };

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="h-full flex flex-col rounded-lg border">
        <ChatLayout key={conversationId} />
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
                    {sessions.map((session, index) => (
                        <Button 
                            key={index} 
                            variant={activeSession === session ? 'secondary' : 'ghost'} 
                            className="justify-start"
                            onClick={() => selectSession(session)}
                        >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            {session}
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
