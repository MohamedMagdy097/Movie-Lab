import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getApiKeys } from '@/utils/api-keys';

// API client will be initialized in the handler with the key from settings

// Configure API options
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Adjust this based on your needs
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
    console.log('Received request with type:', type);

    if (!sceneNumber || ![1, 2, 3, 4].includes(sceneNumber) || !totalScenes || !base64Image || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First analyze the image
    const imageAnalysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and describe what you see in detail, including: the person\'s appearance, clothing, setting, and any notable objects or actions. Format as a brief paragraph.',
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
      max_tokens: 1000,
      temperature: 0.7,
    });

    const imageContext = imageAnalysis.choices[0].message.content || '';
    console.log('Image analysis:', imageContext);

    // Generate suggestions based on type and scene number
    // Define scene-specific context prompts
    const sceneContexts: Record<1 | 2 | 3 | 4, string> = {
      1: "opening the story and establishing the initial setting and tone",
      2: "continuing the narrative from the first scene, building on the established context",
      3: totalScenes === 3 ? "bringing the story to a satisfying conclusion while maintaining continuity" : "developing the story further and building towards the climax",
      4: "bringing the story to a satisfying conclusion with depth and resolution"
    };
    

    const getPromptForScene = (sceneNumber: number, type: string, imageContext: string, totalScenes: number) => {
      const isFinalScene = sceneNumber === totalScenes;
      const isThirdSceneInFourScenes = totalScenes === 4 && sceneNumber === 3;

      if (type === 'description') {
        if (sceneNumber === 1) {
          return `Based on this image: ${imageContext}\n\nYou are starting a short story. Generate a compelling opening scene description for a 5-second video clip that sets up an intriguing narrative. Focus on establishing the mood, setting, and a hint of what's to come. The scene should feel like the beginning of something interesting.`;
        } else if (sceneNumber === 2) {
          return `Based on this image: ${imageContext}\n\nContinuing directly from Scene 1, generate a 5-second scene description that advances the story. The camera should flow naturally from the previous scene's ending position. Focus on developing the narrative tension or emotional arc established in Scene 1.`;
        } else if (isThirdSceneInFourScenes) {
          return `Based on this image: ${imageContext}\n\nContinuing from Scene 2, generate a 5-second scene description that builds towards the story's climax. The camera should flow naturally from the previous scene, intensifying the narrative tension or emotional arc.`;
        } else if (isFinalScene) {
          return `Based on this image: ${imageContext}\n\nThis is the final scene of our story. Generate a 5-second scene description that brings the narrative to a satisfying conclusion. The camera should continue smoothly from the previous scene's ending, creating a natural progression that ties the story together.`;
        }
      } else if (type === 'subtitles') {
        if (sceneNumber === 1) {
          return `Based on this image: ${imageContext}\n\nCreate natural, engaging opening dialogue or narration (5 seconds, 10-15 words) that introduces our story. The dialogue should hook the viewer while establishing the scene's emotional tone.`;
        } else if (sceneNumber === 2) {
          return `Based on this image: ${imageContext}\n\nContinuing the conversation or narration from Scene 1, write the next line of dialogue (5 seconds, 10-15 words). The speech should flow naturally from the previous scene's dialogue, developing the story or emotional arc.`;
        } else if (isThirdSceneInFourScenes) {
          return `Based on this image: ${imageContext}\n\nContinuing the dialogue from Scene 2, write the next line (5 seconds, 10-15 words) that builds towards the story's climax. Maintain the established character voices and increase narrative tension.`;
        } else if (isFinalScene) {
          return `Based on this image: ${imageContext}\n\nWrite the concluding dialogue or narration (5 seconds, 10-15 words) that brings our story to a close. The speech should flow naturally from the previous scene while providing a satisfying conclusion.`;
        }
      } else {
        if (sceneNumber === 1) {
          return `Based on this image: ${imageContext}\n\nYou're creating the opening of a short story. Generate both:\n1. A compelling 5-second opening scene description that establishes an intriguing setting and mood\n2. Opening dialogue or narration (10-15 words) that hooks the viewer and sets up the story's tone\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`;
        } else if (sceneNumber === 2) {
          return `Based on this image: ${imageContext}\n\nContinuing our story from Scene 1, generate both:\n1. A 5-second scene description that naturally follows the previous scene's ending\n2. Dialogue or narration (10-15 words) that continues the conversation/story\n\nEnsure both elements maintain narrative flow and character voices.\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`;
        } else if (isThirdSceneInFourScenes) {
          return `Based on this image: ${imageContext}\n\nBuilding towards our story's climax, generate both:\n1. A 5-second scene description that intensifies the narrative tension\n2. Dialogue or narration (10-15 words) that builds anticipation\n\nMaintain consistency while escalating the story's emotional impact.\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`;
        } else if (isFinalScene) {
          return `Based on this image: ${imageContext}\n\nThis is our story's conclusion. Generate both:\n1. A 5-second scene description that brings the narrative to a satisfying close\n2. Final dialogue or narration (10-15 words) that provides a fitting conclusion\n\nEnsure both elements create a sense of resolution while maintaining consistency.\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`;
        }
      }
      return '';
    };

    const promptContent = getPromptForScene(sceneNumber, type, imageContext, totalScenes);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            type === 'both'
              ? `You are a master storyteller creating a cohesive 3-scene narrative. For Scene ${validatedSceneNumber}, you are ${sceneContexts[validatedSceneNumber]}. Your scene descriptions should create vivid imagery with smooth camera transitions, while your dialogue must feel natural and take exactly 5 seconds to speak (10-15 words). Focus on maintaining narrative flow and emotional continuity between scenes. Format your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`
              : type === 'description'
                ? `You are a cinematographer crafting Scene ${validatedSceneNumber} of a continuous story. You are ${sceneContexts[validatedSceneNumber]}. Create a scene description that flows naturally from the previous scene's ending, with seamless camera movements that enhance the narrative. Your description should evoke clear imagery while maintaining the story's emotional arc. Respond with a scene description as plain text.`
                : `You are a dialogue writer crafting Scene ${validatedSceneNumber} of a continuous story. You are ${sceneContexts[validatedSceneNumber]}. Your dialogue must continue naturally from the previous scene's conversation, maintaining character voices and emotional progression. Keep it concise - exactly 5 seconds when spoken (10-15 words). Respond with dialogue or narration as plain text.`,
        },
        {
          role: 'user',
          content: promptContent,
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content || '';
    console.log('Scene suggestion response:', content);

    // Parse the response based on type
    let suggestion;
    if (type === 'both') {
      try {
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
        suggestion = JSON.parse(jsonStr.trim());
      } catch (error) {
        console.error('Error parsing GPT response:', error);
        return res.status(500).json({ error: 'Failed to parse scene suggestions' });
      }
    } else {
      suggestion =
        type === 'description'
          ? { sceneDescription: content.trim() }
          : { subtitles: content.trim() };
    }

    return res.status(200).json(suggestion);
  } catch (error) {
    console.error('Error generating scene suggestions:', error);
    return res.status(500).json({ error: 'Failed to generate scene suggestions' });
  }
}
