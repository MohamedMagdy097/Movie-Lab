import { NextApiRequest, NextApiResponse } from 'next';
import { fal } from '@fal-ai/client';
import formidable from 'formidable';
import { createReadStream, readFileSync } from 'fs';

if (!process.env.FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

fal.config({
  credentials: process.env.FAL_KEY
});

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req) as [formidable.Fields, formidable.Files];
    const prompts = JSON.parse(fields.prompts?.[0] || '[]') as string[];
    const subtitles = JSON.parse(fields.subtitles?.[0] || '[]') as string[];
    type ValidDuration = "5" | "10";
    const duration = (fields.duration?.[0] || '5') as ValidDuration;
    type ValidAspectRatio = "16:9" | "9:16" | "1:1";
    const aspectRatio = (fields.aspectRatio?.[0] || '16:9') as ValidAspectRatio;
    const imageFile = files.image?.[0];

    if (!prompts.length || !imageFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Read the file and convert to Blob
    const fileBuffer = readFileSync(imageFile.filepath);
    const blob = new Blob([fileBuffer]);
    const uploadedImage = await fal.storage.upload(blob);

    const scenes = prompts.map((prompt, i) => {
      const sceneNum = i + 1;
      const sceneDescription = `Cut Scene ${sceneNum} (5 seconds):`;
      return {
        prompt: `${prompt}${subtitles[i] ? `. The person is saying: ${subtitles[i]}` : ''}`,
        description: sceneDescription,
        subtitles: subtitles[i] || ''
      };
    });

    // Generate video for each scene
    const results = await Promise.all(
      scenes.map(scene =>
        fal.subscribe('fal-ai/kling-video/v1.6/pro/image-to-video', {
          input: {
            prompt: scene.prompt,
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

    // Log and validate results
    console.log('Fal AI raw results:', results);
    
    const processedVideos = results.map((result, index) => {
      console.log(`Processing result ${index}:`, result.data);
      if (!result.data?.video?.url) {
        console.error(`Missing video URL in result ${index}:`, result);
      }
      return {
        url: result.data?.video?.url,  // The video URL is nested in video.url
        description: scenes[index].description,
        subtitles: scenes[index].subtitles
      };
    });

    console.log('Processed videos:', processedVideos);

    return res.status(200).json({
      videos: processedVideos
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error generating video:', err);
    return res.status(500).json({ 
      error: 'Failed to generate video',
      details: err.message || 'Unknown error'
    });
  }
}
