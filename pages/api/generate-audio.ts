import { NextApiRequest, NextApiResponse } from 'next';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';
import { withBodyParser } from '../../lib/middleware';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY environment variable is not set');
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function findMatchingVoice(gender: string, age: string) {
  const response = await client.voices.getAll();
  const voices = response.voices;
  console.log('Available voices:', voices.map(v => ({ id: v.voice_id, name: v.name, labels: v.labels })));

  // Map age categories
  const ageMap: { [key: string]: string[] } = {
    'young': ['young', 'teen', 'twenties'],
    'middle': ['adult', 'middle-aged', 'middle'],
    'old': ['senior', 'elderly', 'old']
  };

  // Find a voice that matches both gender and age
  const matchingVoice = voices.find(voice => {
    const voiceGender = voice.labels?.gender?.toLowerCase();
    const voiceAge = voice.labels?.age?.toLowerCase();
    return voiceGender === gender.toLowerCase() && 
           (ageMap[age] || []).includes(voiceAge || '');
  });

  if (matchingVoice) {
    console.log('Found exact match for gender and age:', matchingVoice.name);
    return matchingVoice;
  }

  // If no exact match, try to match just gender
  const genderMatch = voices.find(voice => 
    voice.labels?.gender?.toLowerCase() === gender.toLowerCase()
  );

  if (genderMatch) {
    console.log('Found gender match:', genderMatch.name);
    return genderMatch;
  }

  // Default voices
  const defaultVoices = {
    female: ['Rachel', 'Bella', 'Elli'],
    male: ['Josh', 'Adam', 'Sam']
  };

  // Try each default voice for the gender
  for (const name of defaultVoices[gender as keyof typeof defaultVoices] || []) {
    const defaultVoice = voices.find(v => v.name === name);
    if (defaultVoice) {
      console.log('Using default voice:', defaultVoice.name);
      return defaultVoice;
    }
  }

  // Absolute fallback to first available voice
  console.log('Using fallback voice:', voices[0].name);
  return voices[0];
}

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, imageUrl } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // First, extract conversation using GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Extract only the conversation/dialogue from the given text. Return only the conversation, without any narration or description."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
    });

    const conversation = completion.choices[0].message.content;
    console.log('Extracted conversation:', conversation);
    const textToSpeak = conversation || text; // Fallback to original text if extraction fails

    // Analyze the image to determine voice characteristics
    let voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // Default voice
    
    const { base64Image } = req.body;
    if (base64Image) {
      try {
        const analysisResponse = await fetch('http://localhost:3000/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image })
        });

        if (analysisResponse.ok) {
          const analysis = await analysisResponse.json();
          console.log('Image analysis for voice:', analysis);
          const matchingVoice = await findMatchingVoice(analysis.gender, analysis.age);
          voiceId = matchingVoice.voice_id;
          console.log('Selected voice:', matchingVoice.name, matchingVoice.voice_id);
        }
      } catch (error) {
        console.error('Error analyzing image for voice selection:', error);
      }
    }

    console.log('Generating audio for text:', textToSpeak);
    
    const response = await client.textToSpeech.convertAsStream(voiceId, {
      text: textToSpeak,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
      }
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);
    const audioBase64 = audioBuffer.toString('base64');
    console.log('Audio generated successfully, size:', audioBuffer.length, 'bytes');

    return res.status(200).json({
      audio: audioBase64
    });
  } catch (error) {
    console.error('Error generating audio:', error);
    return res.status(500).json({ error: 'Failed to generate audio' });
  }
}

export default withBodyParser(handler);
