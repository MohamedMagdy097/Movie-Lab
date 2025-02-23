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
    const prompt = fields.prompt?.[0];
    type ValidDuration = "5" | "10";
    const duration = (fields.duration?.[0] || '5') as ValidDuration;
    type ValidAspectRatio = "16:9" | "9:16" | "1:1";
    const aspectRatio = (fields.aspectRatio?.[0] || '16:9') as ValidAspectRatio;
    const imageFile = files.image?.[0];

    if (!prompt || !imageFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Read the file and convert to Blob
    const fileBuffer = readFileSync(imageFile.filepath);
    const blob = new Blob([fileBuffer]);
    const uploadedImage = await fal.storage.upload(blob);

    // Generate video
    const result = await fal.subscribe('fal-ai/kling-video/v1.6/pro/image-to-video', {
      input: {
        prompt,
        image_url: uploadedImage,
        duration,
        aspect_ratio: aspectRatio
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log('Processing:', update.logs.map((log) => log.message));
        }
      },
    });

    return res.status(200).json(result.data);
  } catch (error) {
    console.error('Error generating video:', error);
    return res.status(500).json({ error: 'Failed to generate video' });
  }
}
