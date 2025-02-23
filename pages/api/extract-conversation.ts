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

    
    console.log('Extracted conversation:', prompt);

    return res.status(200).json({ prompt });
  } catch (error) {
    console.error('Error extracting conversation:', error);
    return res.status(500).json({ error: 'Failed to extract conversation' });
  }
}
