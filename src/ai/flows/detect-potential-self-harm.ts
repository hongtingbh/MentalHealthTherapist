'use server';

/**
 * @fileOverview Detects potential self-harm from journal entries and chat logs.
 *
 * - detectSelfHarm - A function that analyzes text for self-harm indicators.
 * - DetectSelfHarmInput - The input type for the detectSelfHarm function.
 * - DetectSelfHarmOutput - The return type for the detectSelfHarm function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const DetectSelfHarmInputSchema = z.object({
  text: z.string().describe('The text to analyze for self-harm indicators.'),
});
export type DetectSelfHarmInput = z.infer<typeof DetectSelfHarmInputSchema>;

const DetectSelfHarmOutputSchema = z.object({
  selfHarmDetected: z
    .boolean()
    .describe('Whether or not self-harm indicators are detected.'),
  guidance: z.string().describe('Guidance and resources to provide the user.'),
});
export type DetectSelfHarmOutput = z.infer<typeof DetectSelfHarmOutputSchema>;

export async function detectSelfHarm(input: DetectSelfHarmInput): Promise<DetectSelfHarmOutput> {
  return detectSelfHarmFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectSelfHarmPrompt',
  input: {schema: DetectSelfHarmInputSchema},
  output: {schema: DetectSelfHarmOutputSchema},
  model: googleAI.model('gemini-1.5-flash-latest'),
  prompt: `You are a mental health expert. Analyze the following text for indicators of potential self-harm.

Text: {{{text}}}

Based on your analysis, determine if self-harm is detected and provide appropriate guidance and resources.
Set the selfHarmDetected field appropriately. If selfHarmDetected is true, the guidance field should contain resources and advice for the user to seek professional help.`, 
});

const detectSelfHarmFlow = ai.defineFlow(
  {
    name: 'detectSelfHarmFlow',
    inputSchema: DetectSelfHarmInputSchema,
    outputSchema: DetectSelfHarmOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
