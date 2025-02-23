import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getApiKeys } from '@/utils/api-keys'; 
// API client will be initialized in the handler with the key from settings

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { openaiKey } = await getApiKeys(req);

    if (!openaiKey || openaiKey.trim() === '') {
      return res.status(400).json({ error: 'OpenAI API key is not configured. Please set it in the settings.' });
    }

    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    return await processExtractConversation(req, res, openai);
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function processExtractConversation(
req: NextApiRequest, res: NextApiResponse, openai: OpenAI) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Received prompt:', prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Extract the conversation/dialogue from the given text. Return only the conversation, without any narration or description., if you receive only conversation return it as it is."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
    });

    const conversation = completion.choices[0].message.content;
    console.log('Extracted conversation:', conversation);

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error('Error extracting conversation:', error);
    return res.status(500).json({ error: 'Failed to extract conversation' });
  }
}
