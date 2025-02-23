import { NextApiRequest, NextApiResponse } from 'next';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';
import { getApiKeys } from '@/utils/api-keys';


async function findMatchingVoice(client: ElevenLabsClient, gender: string, age: string) {
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
    bodyParser: {
      sizeLimit: '10mb' // For handling base64 images
    },
  },
};

async function processAudioGeneration(req: NextApiRequest, res: NextApiResponse, client: ElevenLabsClient, openai: OpenAI, elevenLabsKey: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, prompt, base64Image } = req.body;
    const textToProcess = text || prompt;

    if (!textToProcess) {
      return res.status(400).json({ error: 'Text or prompt is required' });
    }
    
    console.log('Received text for audio generation:', textToProcess);
    const textToSpeak = textToProcess; // Use the subtitle text directly
    console.log('🔊 Text to be spoken:', textToSpeak);

    // Analyze the image to determine voice characteristics
    let voiceId = 'JBFqnCBsd6RMkjVDRZzb'; // Default voice
    
    if (base64Image) {
      try {
        const imageAnalysisResponse = await openai.chat.completions.create({
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
          temperature: 0
        });

        const content = imageAnalysisResponse.choices[0].message.content || '';
        console.log('GPT-4 Vision response:', content);

        try {
          // Extract JSON from markdown if present
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
          const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
          const analysis = JSON.parse(jsonStr.trim());
          
          // Validate the response format
          if (!analysis.gender || !analysis.age || 
              !['male', 'female'].includes(analysis.gender.toLowerCase()) || 
              !['young', 'middle', 'old'].includes(analysis.age.toLowerCase())) {
            throw new Error('Invalid response format');
          }

          // Normalize the response
          analysis.gender = analysis.gender.toLowerCase();
          analysis.age = analysis.age.toLowerCase();
          
          console.log('Image analysis for voice:', analysis);
          const matchingVoice = await findMatchingVoice(client, analysis.gender, analysis.age);
          if (matchingVoice?.voice_id) {
            voiceId = matchingVoice.voice_id;
            console.log('Selected voice:', matchingVoice.name, matchingVoice.voice_id);
          }
        } catch (parseError) {
          console.error('Error parsing GPT-4 Vision response:', parseError);
        }
      } catch (error) {
        console.error('Error analyzing image for voice selection:', error);
      }
    }

    console.log('Generating audio for text:', textToSpeak);
    
    if (!voiceId) {
      console.error('No valid voice ID found');
      return res.status(500).json({ error: 'Failed to select appropriate voice' });
    }

    try {
      console.log('Starting audio generation for text:', textToSpeak);
      
      // Generate audio using ElevenLabs API directly for better control
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 1.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('ElevenLabs API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to generate audio: ${response.status} ${response.statusText}`);
      }

      console.log('Audio generated successfully, converting to base64...');
      const audioBuffer = await response.arrayBuffer();
      
      if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error('Received empty audio buffer from API');
      }
      
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      console.log('Audio converted to base64, size:', audioBase64.length);

      if (!audioBase64) {
        console.error('No audio data generated');
        return res.status(500).json({ error: 'No audio data generated' });
      }

      return res.status(200).json({
        audio: audioBase64
      });
    } catch (audioError) {
      console.error('Error generating audio stream:', audioError);
      return res.status(500).json({ error: 'Failed to generate audio stream' });
    }
  } catch (error) {
    console.error('Error generating audio:', error);
    return res.status(500).json({ error: 'Failed to generate audio' });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { elevenLabsKey, openaiKey } = await getApiKeys(req);

    if (!elevenLabsKey) {
      return res.status(400).json({ error: 'ElevenLabs API key is not configured. Please set it in the settings.' });
    }

    if (!openaiKey) {
      return res.status(400).json({ error: 'OpenAI API key is not configured. Please set it in the settings.' });
    }

    const client = new ElevenLabsClient({
      apiKey: elevenLabsKey,
    });

    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    return await processAudioGeneration(req, res, client, openai, elevenLabsKey);
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
