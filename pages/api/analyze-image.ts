import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { withBodyParser } from '@/lib/middleware';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser
  },
};


async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'Base64 image data is required' });
    }

    console.log('Analyzing image (base64)');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this image and tell me ONLY two things: 1) the gender (respond with exactly 'male' or 'female'), and 2) the approximate age category (respond with exactly 'young', 'middle', or 'old'). Format your response as a valid JSON object with exactly these two fields: {\"gender\": \"male|female\", \"age\": \"young|middle|old\"}" 
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0 // Make response more deterministic
    });

    let analysis;
    try {
      const content = completion.choices[0].message.content || '';
      console.log('GPT-4 Vision response:', content);
      // Extract JSON from markdown if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      analysis = JSON.parse(jsonStr.trim());
      
      // Validate the response format
      if (!analysis.gender || !analysis.age || 
          !['male', 'female'].includes(analysis.gender.toLowerCase()) || 
          !['young', 'middle', 'old'].includes(analysis.age.toLowerCase())) {
        throw new Error('Invalid response format');
      }

      // Normalize the response
      analysis.gender = analysis.gender.toLowerCase();
      analysis.age = analysis.age.toLowerCase();
    } catch (error) {
      console.error('Error parsing GPT-4 Vision response:', error);
      // Default to a safe fallback
      analysis = { gender: 'female', age: 'young' };
    }
    console.log('Image analysis result:', analysis);

    return res.status(200).json(analysis);
  } catch (error) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
}

export default withBodyParser(handler);
