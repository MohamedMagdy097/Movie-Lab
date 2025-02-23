import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getApiKeys } from '@/utils/api-keys';

// API client will be initialized in the handler with the key from settings

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { openaiKey } = await getApiKeys(req);
    if (!openaiKey || openaiKey.trim() === '') {
      return res.status(400).json({ error: 'OpenAI API key is not configured. Please set it in the settings.' });
    }

    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    return await processSceneSuggestions(req, res, openai);
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
const getPromptForScene = (sceneNumber: number, type: string, imageContext: string, totalScenes: number) => {
  const isFinalScene = sceneNumber === totalScenes;
  const isThirdSceneInFourScenes = totalScenes === 4 && sceneNumber === 3;

  if (type === 'description') {
    if (sceneNumber === 1) {
      return `Based on this image: ${imageContext}\n\nYou are starting a short cinematic story. 
      Generate a **compelling opening scene description** for a **5-second video clip** that sets up the mood and visual aesthetics. 
      - Focus on establishing the setting, character presence, and an intriguing hook. 
      - Describe how the camera moves and how the viewer is introduced to the scene.`;
    } else if (sceneNumber === 2) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 1**, generate a **5-second scene description** that naturally follows from the last frame.
      - The camera should transition smoothly from **Scene 1's ending position**.
      - Introduce **new actions, movement, or setting details** to develop the story.
      - Maintain visual continuity and character focus.`;
    } else if (isThirdSceneInFourScenes) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 2**, generate a **5-second scene description** that builds towards the story's climax.
      - The camera should naturally transition from **Scene 2's final moment**.
      - The story should **intensify in tension or action**, leading to the climax.
      - Maintain a smooth narrative flow while increasing emotional stakes.`;
    } else if (isFinalScene) {
      return `Based on this image: ${imageContext}\n\n**Final Scene - Bringing the story to a conclusion.** 
      Generate a **5-second scene description** that provides a **satisfying resolution.**
      - The camera should transition **smoothly from Scene ${sceneNumber - 1}'s ending.**
      - Ensure the scene **ties up loose ends** and provides narrative closure.
      - Maintain emotional depth while keeping visual continuity.`;
    }
  } else if (type === 'subtitles') {
    if (sceneNumber === 1) {
      return `Based on this image: ${imageContext}\n\nGenerate a **5-second, first-person spoken subtitle (10-15 words).**  
      - The dialogue should **hook the viewer** and establish the **emotional tone** of the story.  
      - The character should be speaking directly as if they are **experiencing the moment**.`;
    } else if (sceneNumber === 2) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 1**, generate a **5-second, first-person spoken subtitle (10-15 words).**  
      - The speech should **flow naturally** from Scene 1's dialogue.  
      - The character should **respond or react** to what happened previously.`;
    } else if (isThirdSceneInFourScenes) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 2**, generate a **5-second, first-person spoken subtitle (10-15 words).**  
      - The dialogue should reflect the **climax or heightened tension** in the story.  
      - The character should **express urgency, realization, or conflict.**`;
    } else if (isFinalScene) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene ${sceneNumber - 1}**, generate a **5-second, first-person spoken subtitle (10-15 words).**  
      - The dialogue should bring the **story to a satisfying conclusion**.  
      - The character should express **resolution, understanding, or emotional closure**.`;
    }
  }

  return ''; // Fallback in case of an invalid scene number or type
};

async function processSceneSuggestions(
  req: NextApiRequest,
  res: NextApiResponse,
  openai: OpenAI
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sceneNumber, totalScenes, base64Image, type = 'both' } = req.body;
    const validatedSceneNumber = sceneNumber as 1 | 2 | 3 | 4;

    if (!sceneNumber || ![1, 2, 3, 4].includes(sceneNumber) || !totalScenes || !base64Image || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Step 1: Extract image context
    const imageAnalysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and describe what you see in detail, including: the person\'s appearance, clothing, setting, and any notable objects or actions. Return the description as a JSON object with a "description" field.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const imageContext = imageAnalysis.choices[0].message.content || '';
    console.log('🔍 Image Context:', imageContext);

    // Scene-specific guidance
    const sceneContexts: Record<1 | 2 | 3 | 4, string> = {
      1: "opening the story and setting the tone with immersive visuals and dialogue",
      2: "developing the story naturally, transitioning smoothly from Scene 1",
      3: "building tension and advancing the story towards its peak",
      4: "bringing the story to a satisfying conclusion while maintaining visual and narrative continuity",
    };

    const isFinalScene = sceneNumber === totalScenes;

    // Generate scene description & subtitles
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `You are a master storyteller creating a cohesive ${totalScenes}-scene narrative. 
          For Scene ${validatedSceneNumber}, you are ${sceneContexts[validatedSceneNumber]}. 

          - Scene descriptions must create vivid imagery and smooth transitions.
          - Subtitles MUST be **spoken in first-person**, natural, and take **exactly 5 seconds (10-15 words).**
          - All responses MUST be formatted strictly as JSON.

          **JSON Format:**
          {
            "sceneDescription": "A vivid description of the scene.",
            "subtitles": "A spoken subtitle (10-15 words)."
          }`,
        },
        {
          role: 'user',
          content: `Based on this image context: "${imageContext}", generate Scene ${sceneNumber} of ${totalScenes}.

          - Provide a 5-second scene description that continues from the previous scene.
          - Create a 10-15 word spoken subtitle that flows naturally from the prior dialogue.

          Return your response as a JSON object with the exact format specified above.`,
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content || '';
    console.log('🎬 Scene Suggestion Response:', content);

    // Log raw content for debugging
    console.log('\n=== RAW CONTENT ===');
    console.log(content);
    console.log('===================\n');

    // Step 3: Parse response and retry if needed
    let suggestion;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      suggestion = JSON.parse(jsonStr.trim());
      
      console.log('\n=== PARSED SUGGESTION ===');
      console.log('Scene Description:', suggestion.sceneDescription);
      console.log('Subtitles:', suggestion.subtitles);
      console.log('========================\n');

      // Ensure valid response
      if (!suggestion.sceneDescription || !suggestion.subtitles || suggestion.subtitles.trim() === '') {
        throw new Error("Missing scene description or subtitles.");
      }
    } catch (error) {
      console.error('⚠️ Error parsing GPT response:', error);
      return res.status(500).json({ error: 'Failed to parse scene suggestions' });
    }

    // Step 4: Ensure valid subtitles (retry if needed)
    const maxRetries = 3;
    const retryAttempt = (req.body.retryAttempt || 0) as number;

    if (!suggestion.subtitles || suggestion.subtitles.trim() === '') {
      console.error(`⚠️ Invalid subtitles (attempt ${retryAttempt + 1}):`, suggestion.subtitles);

      if (retryAttempt < maxRetries) {
        req.body = { ...req.body, retryAttempt: retryAttempt + 1 };
        console.log(`🔄 Retrying subtitles generation (attempt ${retryAttempt + 1} of ${maxRetries})`);
        return await processSceneSuggestions(req, res, openai);
      } else {
        console.log('⚠️ Max retries reached. Generating fallback subtitle.');

        // Regenerate subtitles
        const subtitlesCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: "json_object" },
          messages: [
            {
              role: 'system',
              content: `You are a dialogue writer for a short video. Respond with a JSON object in this format:
              {
                "sceneDescription": "A vivid, detailed description of the scene.",
                "subtitles": "A natural spoken subtitle, exactly 5 seconds long (10-15 words)."
              }`,
            },
            {
              role: 'user',
              content: `Based on this image context: "${imageContext}", regenerate missing subtitles for Scene ${sceneNumber}. Return as a JSON object with the format specified above.`,
            },
          ],
          temperature: 0.7,
        });

        suggestion.subtitles = subtitlesCompletion.choices[0].message.content?.replace(/[`"'*#\n]/g, '').trim() || 'The journey begins here.';
      }
    }

    return res.status(200).json(suggestion);
  } catch (error) {
    console.error('❌ Error generating scene suggestions:', error);
    return res.status(500).json({ error: 'Failed to generate scene suggestions' });
  }
}
