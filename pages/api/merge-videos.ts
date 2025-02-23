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

  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 2) {
    return res.status(400).json({ error: 'At least two video URLs are required for merging' });
  }

  try {
    // Validate video URLs
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

    // Merge the first two videos
    const mergeResponse = await fetch("https://video-merge.198.23.164.177.sslip.io/api/merge/merge-videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url1: videoMetadata[0].url,
        url2: videoMetadata[1].url,
      }),
    });

    if (!mergeResponse.ok) {
      throw new Error("Failed to merge videos");
    }

    const mergeResult = await mergeResponse.json();

    if (!mergeResult.merged_path || !mergeResult.public_url) {
      throw new Error("Merging API did not return a valid response");
    }

    return res.status(200).json({
      message: "Videos merged successfully",
      mergedVideoUrl: mergeResult.public_url, // Use public URL for easy access
      mergedPath: mergeResult.merged_path, // Local path for reference if needed
    });
  } catch (error: any) {
    console.error("Error merging videos:", error);
    return res.status(500).json({ error: error.message || "Failed to merge videos" });
  }
}
