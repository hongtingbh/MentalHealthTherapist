'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { JournalEntry, Mood } from "@/lib/definitions";
import { format } from 'date-fns';
import { Smile, Frown, Meh, Wind, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "../ui/skeleton";

const MOOD_DETAILS: Record<Mood, { icon: React.ReactNode; color: string }> = {
  Happy: { icon: <Smile className="h-5 w-5" />, color: "bg-green-500/20 text-green-700 border-green-300" },
  Calm: { icon: <Wind className="h-5 w-5" />, color: "bg-blue-500/20 text-blue-700 border-blue-300" },
  Neutral: { icon: <Meh className="h-5 w-5" />, color: "bg-gray-500/20 text-gray-700 border-gray-300" },
  Sad: { icon: <Frown className="h-5 w-5" />, color: "bg-purple-500/20 text-purple-700 border-purple-300" },
  Anxious: { icon: <Activity className="h-5 w-5" />, color: "bg-yellow-500/20 text-yellow-700 border-yellow-300" },
};

function JournalCard({ entry }: { entry: JournalEntry }) {
  const moodDetail = MOOD_DETAILS[entry.mood];
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  
  return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-xl">{entry.summary}</CardTitle>
            <CardDescription>{format(createdAt, "MMMM d, yyyy 'at' h:mm a")}</CardDescription>
          </div>
          <Badge variant="outline" className={`flex items-center gap-2 ${moodDetail.color}`}>
            {moodDetail.icon}
            {entry.mood}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground line-clamp-3">{entry.content}</p>
      </CardContent>
      <CardFooter>
        {/* Can add actions here in the future */}
      </CardFooter>
    </Card>
  );
}

export function JournalList({ initialEntries, isLoading }: { initialEntries: JournalEntry[], isLoading: boolean }) {
  if (isLoading) {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full mt-2" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
  }
  
  if (initialEntries.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold">No entries yet</h2>
        <p className="text-muted-foreground mt-2">Click "New Entry" to start your mindful journey.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {initialEntries.map((entry) => (
        <JournalCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
