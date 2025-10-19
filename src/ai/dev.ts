import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-journal-entry.ts';
import '@/ai/flows/detect-potential-self-harm.ts';
import '@/ai/flows/classify-mood-disorders.ts';