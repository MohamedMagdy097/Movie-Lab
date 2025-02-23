import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure API options
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Adjust this based on your needs
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sceneNumber, totalScenes, base64Image, type = 'both' } = req.body;
    console.log('Received request with type:', type);

    if (!sceneNumber || !totalScenes || !base64Image || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First analyze the image
    const imageAnalysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analyze this image and describe what you see in detail, including: the person's appearance, clothing, setting, and any notable objects or actions. Format as a brief paragraph." 
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
      temperature: 0.7
    });

    const imageContext = imageAnalysis.choices[0].message.content || '';
    console.log('Image analysis:', imageContext);

    // Generate suggestions based on type and scene number
    const promptContent = type === 'description' ? 
      sceneNumber === 1 ?
        `Based on this image: ${imageContext}\n\nGenerate a compelling opening scene description for a 5-second video clip. Focus on establishing the setting, movement, emotion, and visual interest.` :
        `Based on this image: ${imageContext}\n\nGenerate a compelling scene description that continues naturally from the previous scene (scene ${sceneNumber} of ${totalScenes}). The camera should start from where the last scene ended, ensuring a smooth 5-second transition. Focus on continuing the story flow while maintaining visual interest.` :
      type === 'subtitles' ? 
        sceneNumber === 1 ?
          `Based on this image: ${imageContext}\n\nGenerate natural, engaging opening dialogue or narration for a 5-second video clip. The dialogue should establish the scene's context and feel authentic.` :
          `Based on this image: ${imageContext}\n\nGenerate natural dialogue or narration that continues directly from the previous scene (scene ${sceneNumber} of ${totalScenes}). This 5-second clip should flow seamlessly from the previous conversation or narration, maintaining context and character voices.` :
        sceneNumber === 1 ?
          `Based on this image: ${imageContext}\n\nGenerate both:\n1. A compelling 5-second opening scene description that establishes the setting and visual interest\n2. Opening dialogue or narration that sets up the scene naturally\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.` :
          `Based on this image: ${imageContext}\n\nFor scene ${sceneNumber} of ${totalScenes}, generate both:\n1. A compelling 5-second scene description that continues naturally from the previous scene, ensuring smooth camera transitions\n2. Dialogue or narration that continues directly from the previous scene's conversation\n\nEnsure both the visuals and dialogue flow seamlessly from the previous scene.\n\nFormat your response as a JSON object with 'sceneDescription' and 'subtitles' fields.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: type === 'both' ?
            `You are a creative video scene planner for a continuous story. For scene ${sceneNumber} of ${totalScenes}, ensure your scene descriptions and dialogue flow naturally from the previous scenes. The dialogue MUST be very concise and take exactly 5 seconds to speak at a natural pace (about 10-15 words maximum). Format your response as a JSON object with 'sceneDescription' and 'subtitles' fields.` :
            type === 'description' ?
            `You are a creative video scene planner. For scene ${sceneNumber} of ${totalScenes}, ensure your scene description continues naturally from the previous scene, with smooth camera transitions. Respond with a scene description as plain text.` :
            `You are a creative video scene planner. For scene ${sceneNumber} of ${totalScenes}, ensure your dialogue continues naturally from the previous scene's conversation. The dialogue MUST be very concise and take exactly 5 seconds to speak at a natural pace (about 10-15 words maximum). Respond with dialogue or narration as plain text.`
        },
        {
          role: "user",
          content: promptContent
        }
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
      suggestion = type === 'description' ? 
        { sceneDescription: content.trim() } :
        { subtitles: content.trim() };
    }

    return res.status(200).json(suggestion);
  } catch (error) {
    console.error('Error generating scene suggestions:', error);
    return res.status(500).json({ error: 'Failed to generate scene suggestions' });
  }
}
