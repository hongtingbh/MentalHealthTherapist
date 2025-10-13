'use server';
/**
 * @fileOverview This file defines a Genkit flow for classifying potential mood disorders (PTSD, GAD, MMD) from user messages, including multimedia content.
 *
 * - classifyMoodDisorders - The main function to classify mood disorders.
 * - ClassifyMoodDisordersInput - The input type for the classifyMoodDisorders function.
 * - ClassifyMoodDisordersOutput - The output type for the classifyMoodDisorders function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyMoodDisordersInputSchema = z.object({
  message: z.string().describe('The text message from the user.'),
  mediaDataUri: z
    .string()
    .optional()
    .describe(
      "Optional media data URI (image, audio, or video) that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ClassifyMoodDisordersInput = z.infer<typeof ClassifyMoodDisordersInputSchema>;

const ClassifyMoodDisordersOutputSchema = z.object({
  ptsdSymptoms: z.array(z.string()).describe('Potential PTSD symptoms identified.'),
  gadSymptoms: z.array(z.string()).describe('Potential GAD symptoms identified.'),
  mmdSymptoms: z.array(z.string()).describe('Potential MMD symptoms identified.'),
  summary: z.string().describe('A summary of the identified symptoms and potential mood disorders.'),
});
export type ClassifyMoodDisordersOutput = z.infer<typeof ClassifyMoodDisordersOutputSchema>;

export async function classifyMoodDisorders(
  input: ClassifyMoodDisordersInput
): Promise<ClassifyMoodDisordersOutput> {
  return classifyMoodDisordersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyMoodDisordersPrompt',
  input: {schema: ClassifyMoodDisordersInputSchema},
  output: {schema: ClassifyMoodDisordersOutputSchema},
  prompt: `You are an AI assistant designed to identify potential symptoms of PTSD, GAD, and MMD from user messages, including text and multimedia content.

  Analyze the following user message and media (if available) to identify potential symptoms related to PTSD, GAD, and MMD. Provide a summary of the identified symptoms and potential mood disorders.

  Message: {{{message}}}
  {{#if mediaDataUri}}
  Media: {{media url=mediaDataUri}}
  {{/if}}

  Output the identified symptoms in JSON format for PTSD, GAD and MMD, as well as a text summary.
`,
});

const classifyMoodDisordersFlow = ai.defineFlow(
  {
    name: 'classifyMoodDisordersFlow',
    inputSchema: ClassifyMoodDisordersInputSchema,
    outputSchema: ClassifyMoodDisordersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
