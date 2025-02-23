import { NextApiRequest, NextApiResponse } from 'next';
import puppeteer from 'puppeteer';

// Extend Window interface
declare global {
  interface Window {
    frameExtracted?: boolean;
    videoError?: string;
    frameData?: string;
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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

  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true
    });
    const page = await browser.newPage();

    // Create HTML with video element
    await page.setContent(`
      <html>
        <body>
          <video id="video" preload="auto" style="display: none;">
            <source src="${videoUrl}" type="video/mp4">
          </video>
          <canvas id="canvas" style="display: none;"></canvas>
          <script>
            async function extractFrame() {
              const video = document.getElementById('video');
              const canvas = document.getElementById('canvas');
              if (!video || !canvas) throw new Error('Elements not found');

              return new Promise((resolve, reject) => {
                video.addEventListener('error', (e) => {
                  reject(new Error('Video failed to load'));
                });

                video.addEventListener('loadeddata', async () => {
                  try {
                    // Wait a bit for the video to be ready
                    await new Promise(r => setTimeout(r, 1000));
                    
                    // Set to last frame
                    video.currentTime = video.duration;
                    
                    // Wait for seek to complete
                    await new Promise(r => video.addEventListener('seeked', r, { once: true }));
                    
                    // Extract frame
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Could not get canvas context');
                    
                    ctx.drawImage(video, 0, 0);
                    const frameData = canvas.toDataURL('image/jpeg');
                    
                    if (!frameData || frameData === 'data:,') {
                      reject(new Error('Failed to extract frame'));
                    } else {
                      resolve(frameData);
                    }
                  } catch (error) {
                    reject(error);
                  }
                });
              });
            }

            extractFrame()
              .then(frameData => {
                window.frameData = frameData;
                window.frameExtracted = true;
              })
              .catch(error => {
                window.videoError = error.message;
              });
          </script>
        </body>
      </html>
    `);

    // Wait for frame extraction with a reasonable timeout
    const result = await page.waitForFunction(
      () => (window as any).frameExtracted === true || (window as any).videoError,
      { timeout: 30000 }
    );

    // Check for errors
    const error = await page.evaluate(() => (window as any).videoError);
    if (error) {
      throw new Error(`Failed to extract frame: ${error}`);
    }

    // Get the extracted frame
    const frameData = await page.evaluate(() => (window as any).frameData);

    return res.status(200).json({ 
      frame: frameData
    });
  } catch (error) {
    console.error('Error extracting frame:', error);
    return res.status(500).json({ error: 'Failed to extract frame' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
