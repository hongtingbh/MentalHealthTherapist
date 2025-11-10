'use client';

import { ChatLayout } from '@/components/chat/chat-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

// Mock data for sessions
const SESSIONS = ['Session 1', 'Session 2', 'Session 3'];

export default function ChatPage() {
    const [activeSession, setActiveSession] = useState('Session 3');

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div className="h-full flex flex-col rounded-lg border">
        <ChatLayout />
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
            <Button className="mb-4">
              <PlusCircle className="mr-2 h-4 w-4" /> New Session
            </Button>
            <ScrollArea className="flex-grow">
                <div className="flex flex-col gap-2">
                    {SESSIONS.map((session, index) => (
                        <Button 
                            key={index} 
                            variant={activeSession === session ? 'secondary' : 'ghost'} 
                            className="justify-start"
                            onClick={() => setActiveSession(session)}
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
