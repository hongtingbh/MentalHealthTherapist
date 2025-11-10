'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Paperclip,
  Send,
  Loader2,
  AlertTriangle,
  File as FileIcon,
  X,
  Sparkles
} from 'lucide-react';
import { ChatMessage } from '@/lib/definitions';
import { postChatMessage } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

const userAvatar = PlaceHolderImages.find((p) => p.id === 'user-avatar');

const assistantWelcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hello! I'm here to listen and support you. How are you feeling today? Feel free to share what's on your mind.",
};

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

export function ChatLayout() {
  const [messages, setMessages] = useState<ChatMessage[]>([assistantWelcomeMessage]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'chatMessages'),
      orderBy('timestamp', 'asc')
    );
  }, [user, firestore]);

  const { data: initialMessages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages([assistantWelcomeMessage, ...initialMessages]);
    } else {
      setMessages([assistantWelcomeMessage]);
    }
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if(selectedFile.size > 4 * 1024 * 1024){
            toast({
                title: 'File too large',
                description: 'Please upload a file smaller than 4MB.',
                variant: 'destructive'
            })
            return;
        }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!user) {
        toast({ title: "Not logged in", description: "You must be logged in to chat."});
        return;
    }

    const userMessage: ChatMessage = {
      id: new Date().toISOString(),
      role: 'user',
      text: input,
      ...(file && { mediaUrl: URL.createObjectURL(file), mediaMimeType: file.type }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    let mediaDataUri: string | undefined = undefined;

    if (file) {
      mediaDataUri = await fileToDataURL(file);
    }
    setFile(null);


    startTransition(async () => {
      const assistantResponse = await postChatMessage(user.uid, input, mediaDataUri);
      setMessages((prev) => [...prev, assistantResponse]);
    });
  };

  const Message = ({ msg }: { msg: ChatMessage }) => {
    const isAssistant = msg.role === 'assistant';

    return (
      <div className={cn('flex items-start gap-4', isAssistant ? '' : 'justify-end')}>
        {isAssistant && (
            <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="h-5 w-5"/></AvatarFallback>
            </Avatar>
        )}
        <div className={cn('max-w-md rounded-lg p-3', 
          isAssistant ? 'bg-muted' : 'bg-primary text-primary-foreground'
        )}>
            {msg.selfHarmWarning && (
                <Card className="mb-3 bg-destructive/20 border-destructive">
                    <CardHeader className="p-4">
                        <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={20}/> Important</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-destructive-foreground">
                        <p className="font-semibold">{msg.text}</p>
                        <p className="text-sm mt-2">{msg.selfHarmWarning}</p>
                    </CardContent>
                </Card>
            )}
            
            {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}

            {msg.mediaUrl && (
                <div className="mt-2">
                    {msg.mediaMimeType?.startsWith('image/') ? (
                        <Image src={msg.mediaUrl} alt="Uploaded content" width={200} height={200} className="rounded-lg object-cover" />
                    ) : (
                        <div className="p-2 bg-background/50 rounded-lg text-sm">
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileIcon size={16} />
                                <span>{msg.mediaMimeType}</span>
                            </a>
                        </div>
                    )}
                </div>
            )}
            {msg.classification && (
                <div className="mt-4 border-t pt-2">
                    <h4 className="text-xs font-semibold mb-2">Symptom Analysis</h4>
                    <div className="flex flex-wrap gap-1">
                        {msg.classification.ptsdSymptoms.slice(0,2).map(s => <Badge key={s} variant="secondary">PTSD: {s}</Badge>)}
                        {msg.classification.gadSymptoms.slice(0,2).map(s => <Badge key={s} variant="secondary">GAD: {s}</Badge>)}
                        {msg.classification.mmdSymptoms.slice(0,2).map(s => <Badge key={s} variant="secondary">MMD: {s}</Badge>)}
                    </div>
                </div>
            )}
        </div>
        {!isAssistant && (
             <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || userAvatar?.imageUrl} />
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <Message key={msg.id || index} msg={msg} />
        ))}
        {isPending && (
          <div className="flex items-start gap-4">
            <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="h-5 w-5"/></AvatarFallback>
            </Avatar>
            <div className="max-w-md rounded-lg p-3 bg-muted flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin"/>
                <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="relative">
          {file && (
            <div className="absolute bottom-full left-0 right-0 p-2 bg-muted border-t border-x rounded-t-lg">
                <div className="flex items-center justify-between bg-background p-2 rounded">
                    <div className="flex items-center gap-2 text-sm">
                        <FileIcon size={16} />
                        <span>{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                        <X size={16} />
                    </Button>
                </div>
            </div>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message or upload a file..."
            className="pr-24 min-h-[48px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-5 h-5" />
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,audio/*,video/*" />
            <Button type="submit" size="icon" disabled={(!input.trim() && !file) || isPending}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
