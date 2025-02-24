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
      - Focus on establishing the environment's atmosphere: lighting, colors, textures, and spatial layout.
      - Describe the subject's positioning and presence within the frame.
      - Detail key visual elements and their arrangement that enhance the storytelling.
      - Include precise camera movements that introduce the viewer to this scene.`;
    } else if (sceneNumber === 2) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 1**, generate a **5-second scene description** that deepens the narrative.
      - Begin exactly where Scene 1 ended, maintaining visual continuity.
      - Show how the subject's interaction with their environment evolves.
      - Reveal new details about the setting or elements that weren't visible before.
      - Describe meaningful movements or actions that develop the story.`;
    } else if (isThirdSceneInFourScenes) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 2**, generate a **5-second scene description** that elevates the story's energy.
      - Focus on how the lighting and atmosphere shift to create anticipation.
      - Detail the subject's movements and interactions with their surroundings.
      - Show how the environment complements the subject's actions.
      - Create a sense of building momentum in the scene.`;
    } else if (isFinalScene) {
      return `Based on this image: ${imageContext}\n\n**Final Scene - Creating a powerful conclusion.** 
      Generate a **5-second scene description** that brings the story full circle.
      - Connect visually to Scene ${sceneNumber - 1}'s energy while elevating the mood.
      - Detail how the scene's composition has evolved from the first scene.
      - Show how all visual elements come together for impact.
      - End with a camera movement that captures the scene's final message.`;
    }
  } else if (type === 'subtitles') {
    if (sceneNumber === 1) {
      return `Based on this image: ${imageContext}\n\nGenerate a **5-second, first-person spoken subtitle (10-15 words)** that:
      - Introduces the speaker and their purpose
      - Hints at what's to come in the video
      - Creates intrigue about the subject matter`;
    } else if (sceneNumber === 2) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 1**, generate a **5-second, first-person spoken subtitle (10-15 words)** that:
      - Builds on the opening message
      - Begins revealing key information or insights
      - Shows growing engagement with the viewer`;
    } else if (isThirdSceneInFourScenes) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene 2**, generate a **5-second, first-person spoken subtitle (10-15 words)** that:
      - Demonstrates deeper understanding of the subject
      - Shares a specific insight or observation
      - Builds anticipation for the conclusion`;
    } else if (isFinalScene) {
      return `Based on this image: ${imageContext}\n\n**Continuing from Scene ${sceneNumber - 1}**, generate a **5-second, first-person spoken subtitle (10-15 words)** that:
      - Delivers on the video's promise
      - Provides valuable takeaways for viewers
      - Creates a memorable final impression`;
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
    // Generate scene description using getPromptForScene
    const descriptionPrompt = getPromptForScene(validatedSceneNumber, 'description', imageContext, totalScenes);
    const subtitlesPrompt = getPromptForScene(validatedSceneNumber, 'subtitles', imageContext, totalScenes);

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
          content: `${descriptionPrompt}

${subtitlesPrompt}

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
