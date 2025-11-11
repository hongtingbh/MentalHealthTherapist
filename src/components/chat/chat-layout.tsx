'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Paperclip,
  Send,
  Loader2,
  FileIcon,
  X,
  Sparkles
} from 'lucide-react';
import { ChatMessage } from '@/lib/definitions';
import { postChatMessage } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getApp } from 'firebase/app';


const userAvatar = PlaceHolderImages.find((p) => p.id === 'user-avatar');

const assistantWelcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hello! I'm here to listen and support you. How are you feeling today? Feel free to share what's on your mind.",
};

export function ChatLayout({ sessionId, sessionName }: { sessionId: string; sessionName: string; }) {
  const [messages, setMessages] = useState<ChatMessage[]>([assistantWelcomeMessage]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !sessionId) return null;
    return query(
      collection(firestore, `users/${user.uid}/sessions/${sessionId}/messages`),
      orderBy('timestamp', 'asc')
    );
  }, [user, firestore, sessionId]);

  const { data: initialMessages } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    if (initialMessages) {
      if (initialMessages.length > 0) {
        setMessages([assistantWelcomeMessage, ...initialMessages]);
      } else {
        setMessages([assistantWelcomeMessage]);
      }
    }
  }, [initialMessages]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
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

    const userMessageText = input;
    const userMessageFile = file;

    // Clear the input fields immediately
    setInput('');
    setFile(null);

    // Handle file upload
    if (userMessageFile) {
      setIsUploading(true);
      try {
        const firebaseApp = getApp();
        const storage = getStorage(firebaseApp);
        const filePath = `users/${user.uid}/uploads/${sessionId}/${Date.now()}-${userMessageFile.name}`;
        const fileRef = storageRef(storage, filePath);
        
        await uploadBytes(fileRef, userMessageFile);
        const mediaUrl = await getDownloadURL(fileRef);

        // Now post the message with the URL
        await postChatMessage(user.uid, sessionId, userMessageText, mediaUrl);

      } catch (error) {
        console.error("Error uploading file or posting message:", error);
        toast({ title: "Action Failed", description: "Could not upload your file or send the message.", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    } else {
       // Handle text-only message
       startTransition(async () => {
         try {
            await postChatMessage(user.uid, sessionId, userMessageText);
         } catch(error) {
            console.error("Error posting message:", error);
            toast({ title: "Message Failed", description: "Could not send the message.", variant: "destructive" });
         }
      });
    }
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
            
            {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}

            {msg.mediaUrl && (
                <div className="mt-2">
                    {msg.mediaMimeType?.startsWith('image/') || msg.mediaUrl.includes('.png') || msg.mediaUrl.includes('.jpg') || msg.mediaUrl.includes('.jpeg') || msg.mediaUrl.includes('image') ? (
                        <Image src={msg.mediaUrl} alt="Uploaded content" width={200} height={200} className="rounded-lg object-cover" />
                    ) : msg.mediaMimeType?.startsWith('video/') || msg.mediaUrl.includes('.mp4') || msg.mediaUrl.includes('video') ? (
                        <video src={msg.mediaUrl} width="200" controls className="rounded-lg" />
                    ): (
                        <div className="p-2 bg-background/50 rounded-lg text-sm">
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileIcon size={16} />
                                <span>{msg.mediaMimeType || 'Attachment'}</span>
                            </a>
                        </div>
                    )}
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

  const isSending = isPending || isUploading;

  return (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b bg-background">
        <h2 className="text-xl font-semibold truncate">{sessionName}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <Message key={msg.id || index} msg={msg} />
        ))}
        {isSending && (
          <div className="flex items-start gap-4 justify-end">
            <div className="max-w-md rounded-lg p-3 bg-primary text-primary-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin"/>
                <span className="text-sm">Sending...</span>
            </div>
             <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || userAvatar?.imageUrl} />
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="relative">
          {file && (
            <div className="absolute bottom-full left-0 right-0 p-2 bg-muted border-t border-x rounded-t-lg">
                <div className="flex items-center justify-between bg-background p-2 rounded">
                    <div className="flex items-center gap-2 text-sm truncate">
                        <FileIcon size={16} />
                        <span className="truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setFile(null)}>
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
            <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
              <Paperclip className="w-5 h-5" />
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,audio/*,video/*" />
            <Button type="submit" size="icon" disabled={(!input.trim() && !file) || isSending}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
