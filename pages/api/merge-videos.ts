import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoUrls } = req.body;

  if (!videoUrls || !Array.isArray(videoUrls)) {
    return res.status(400).json({ error: 'Valid video URLs array is required' });
  }

  try {
    // Validate that all URLs are accessible
    const urlValidationPromises = videoUrls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Failed to access video URL: ${url}`);
        }
        return {
          url,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        };
      } catch (error) {
        throw new Error(`Invalid video URL: ${url}`);
      }
    });

    const videoMetadata = await Promise.all(urlValidationPromises);

    // Return the validated video URLs and their metadata
    return res.status(200).json({
      videos: videoMetadata,
      message: 'Videos validated successfully. Use MediaSource API for client-side playback.'
    });
  } catch (error) {
    console.error('Error validating videos:', error);
    return res.status(500).json({ error: error.message || 'Failed to validate videos' });
  }
}
