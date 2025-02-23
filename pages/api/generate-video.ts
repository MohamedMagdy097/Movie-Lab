import { NextApiRequest, NextApiResponse } from 'next';
import { fal } from '@fal-ai/client';
import formidable from 'formidable';
import { readFileSync } from 'fs';
import { getApiKeys } from '@/utils/api-keys';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { falKey } = await getApiKeys(req);


    if (!falKey || falKey.trim() === '') {
      console.error("🚨 Fal.ai API key is missing or invalid!");
      return res.status(400).json({ error: 'Fal.ai API key is not configured. Please set it in the settings.' });
    }

    return await processVideoGeneration(req, res, falKey);
  } catch (error) {
    console.error('❌ Error in handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function processVideoGeneration(req: NextApiRequest, res: NextApiResponse, falKey: string) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }


  // Configure fal.ai client with the correct API key
  fal.config({
    credentials: falKey
  });

  try {
    // Parse form data
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB
    const [fields, files] = await form.parse(req) as [formidable.Fields, formidable.Files];

    const prompts = JSON.parse(fields.prompts?.[0] || '[]') as string[];
    const subtitles = JSON.parse(fields.subtitles?.[0] || '[]') as string[];
    const duration = (fields.duration?.[0] || '5') as "5" | "10";
    const aspectRatio = (fields.aspectRatio?.[0] || '16:9') as "16:9" | "9:16" | "1:1";
    const imageFile = files.image?.[0];

    if (!prompts.length || !imageFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log("📸 Image file received:", imageFile.originalFilename);

    // Read file and upload to Fal storage
    const fileBuffer = readFileSync(imageFile.filepath);
    const uploadedImage = await fal.storage.upload(new Blob([fileBuffer]));

    console.log("📤 Uploaded image URL:", uploadedImage);

    // Generate video for each scene
    const results = await Promise.all(
      prompts.map((prompt, i) =>
        fal.subscribe('fal-ai/kling-video/v1.6/pro/image-to-video', {
          input: {
            prompt: `${prompt}. The person is saying: ${subtitles[i] || ''}`,
            image_url: uploadedImage,
            duration: '5',
            aspect_ratio: aspectRatio
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              console.log('Processing:', update.logs.map((log) => log.message));
            }
          },
        })
      )
    );

    console.log('✅ Fal AI raw results:', results);

    // Validate results
    const processedVideos = results.map((result, index) => {
      console.log(`Processing result ${index}:`, result.data);
      return {
        url: result.data?.video?.url || null,
        description: `Scene ${index + 1}`,
        subtitles: subtitles[index] || ''
      };
    });

    console.log('🎥 Processed videos:', processedVideos);

    return res.status(200).json({
      videos: processedVideos.filter(v => v.url)
    });
  } catch (error: unknown) {
    console.error('❌ Error generating video:', error);
    return res.status(500).json({ 
      error: 'Failed to generate video',
      details: (error as Error).message || 'Unknown error'
    });
  }
}
