import { ChatLayout } from '@/components/chat/chat-layout';
import { MessageSquare, Heart, Shield } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <ChatLayout />
      </div>
    </div>
  );
}
