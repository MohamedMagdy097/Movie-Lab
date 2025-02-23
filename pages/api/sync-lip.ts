import { NextApiRequest, NextApiResponse } from 'next';
import { fal } from "@fal-ai/client";
import { getApiKeys } from '@/utils/api-keys';

export const config = {
  api: {
    bodyParser: true, // Enable the default body parser
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
    const { falKey } = await getApiKeys(req); // Get the FAL API key from headers or env
    console.log("🔑 Retrieved FAL Key:", falKey);

    if (!falKey || falKey.trim() === '') {
      return res.status(400).json({ error: 'FAL API key is not configured. Please set it in the settings.' });
    }

    fal.config({
      credentials: falKey
    });

    const { videoUrl, audioUrl } = req.body;

    if (!videoUrl || !audioUrl) {
      return res.status(400).json({ error: 'Video URL and Audio URL are required' });
    }

    console.log('🎬 Starting lip sync with:', { videoUrl, audioUrl });

    const result = await fal.subscribe("fal-ai/latentsync", {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
        guidance_scale: 1,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('🔄 Lip sync progress:', update.logs.map((log) => log.message));
        }
      },
    });

    console.log('✅ Lip sync completed:', result.data);

    // Extract the video URL from the result
    const syncedVideoUrl = result.data.video.url;
    console.log('📽️ Synced video URL:', syncedVideoUrl);
    
    return res.status(200).json({
      url: syncedVideoUrl
    });
  } catch (error) {
    console.error('❌ Error in lip sync:', error);
    return res.status(500).json({ error: 'Failed to sync lip movement' });
  }
}
