import { getJournalEntries } from "@/lib/actions";
import { JournalList } from "@/components/journal/journal-list";
import { NewJournalEntry } from "@/components/journal/new-journal-entry";

export default async function JournalPage() {
  const initialEntries = await getJournalEntries();

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">My Journal</h1>
          <p className="text-muted-foreground">
            A space for your thoughts, feelings, and reflections.
          </p>
        </div>
        <NewJournalEntry />
      </div>
      <JournalList initialEntries={initialEntries} />
    </div>
  );
}
