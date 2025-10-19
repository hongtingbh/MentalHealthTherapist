import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BookHeart,
  MessageSquare,
  Smile,
  Frown,
  Meh,
  Wind,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getJournalEntries } from "@/lib/actions";
import { Mood, MoodDataItem } from "@/lib/definitions";
import { formatDistanceToNow } from "date-fns";
import { MoodChart } from "@/components/dashboard/mood-chart";

const MOOD_ICONS: Record<Mood, React.ReactNode> = {
  Happy: <Smile className="h-5 w-5 text-green-500" />,
  Calm: <Wind className="h-5 w-5 text-blue-500" />,
  Neutral: <Meh className="h-5 w-5 text-gray-500" />,
  Sad: <Frown className="h-5 w-5 text-purple-500" />,
  Anxious: <Activity className="h-5 w-5 text-yellow-500" />,
};

const getMoodData = async () => {
  const entries = await getJournalEntries();
  const moodCounts: Record<Mood, number> = {
    Happy: 0,
    Calm: 0,
    Neutral: 0,
    Sad: 0,
    Anxious: 0,
  };

  entries.forEach((entry) => {
    moodCounts[entry.mood]++;
  });

  const moodData: MoodDataItem[] = Object.entries(moodCounts).map(
    ([mood, count]) => ({
      mood: mood as Mood,
      count,
    })
  );

  return moodData;
};

export default async function Dashboard() {
  const recentEntries = (await getJournalEntries()).slice(0, 5);
  const moodData = await getMoodData();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Entries
              </CardTitle>
              <BookHeart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentEntries.length}</div>
              <p className="text-xs text-muted-foreground">
                entries logged all time
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Chat Sessions
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12</div>
              <p className="text-xs text-muted-foreground">
                +2 since last week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mood Trend</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Positive</div>
              <p className="text-xs text-muted-foreground">
                Your mood has been generally positive
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                New Journal Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full" asChild>
                <Link href="/journal">Write Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Journal Entries</CardTitle>
                <CardDescription>
                  A look at your most recent thoughts and feelings.
                </CardDescription>
              </div>
              <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="/journal">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mood</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="hidden md:table-cell text-right">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.length > 0 ? (
                    recentEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="font-medium">
                            {MOOD_ICONS[entry.mood]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.summary}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right">
                          {formatDistanceToNow(new Date(entry.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        No journal entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mood Analysis</CardTitle>
              <CardDescription>
                A summary of your logged moods over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MoodChart moodData={moodData} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}