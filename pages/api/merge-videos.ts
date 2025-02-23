import { NextApiRequest, NextApiResponse } from 'next';
import puppeteer from 'puppeteer';

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

  const { videoUrls } = req.body;

  if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ error: 'Video URLs array is required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true
    });
    const page = await browser.newPage();

    // Create HTML with video elements and FFmpeg.js
    await page.setContent(`
      <html>
        <body>
          <div id="videos">
            ${videoUrls.map((url, i) => `
              <video id="video${i}" style="display: none;">
                <source src="${url}" type="video/mp4">
              </video>
            `).join('')}
          </div>
          <canvas id="canvas" style="display: none;"></canvas>
          <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.7/dist/ffmpeg.min.js"></script>
          <script>
            async function mergeVideos() {
              try {
                const { createFFmpeg, fetchFile } = FFmpeg;
                const ffmpeg = createFFmpeg({ log: true });
                await ffmpeg.load();

                // Download each video and write to FFmpeg virtual filesystem
                for (let i = 0; i < ${videoUrls.length}; i++) {
                  const video = document.getElementById('video' + i);
                  const response = await fetch(video.src);
                  const data = await response.arrayBuffer();
                  ffmpeg.FS('writeFile', 'video' + i + '.mp4', new Uint8Array(data));
                }

                // Create concat file
                const concat = ${videoUrls.length > 0 ? videoUrls.map((_, i) => `file 'video${i}.mp4'`).join('\\n') : ''};
                ffmpeg.FS('writeFile', 'concat.txt', concat);

                // Merge videos
                await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4');
                
                // Read the output file
                const data = ffmpeg.FS('readFile', 'output.mp4');
                const blob = new Blob([data.buffer], { type: 'video/mp4' });
                
                // Convert to base64
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = function() {
                  window.mergedVideo = reader.result;
                  window.mergingComplete = true;
                }
              } catch (error) {
                console.error('Error merging videos:', error);
                window.mergingError = error.message;
                window.mergingComplete = true;
              }
            }

            // Start merging when all videos are loaded
            let loadedVideos = 0;
            const totalVideos = ${videoUrls.length};
            
            function checkAllLoaded() {
              loadedVideos++;
              if (loadedVideos === totalVideos) {
                mergeVideos();
              }
            }

            for (let i = 0; i < totalVideos; i++) {
              const video = document.getElementById('video' + i);
              video.addEventListener('loadeddata', checkAllLoaded);
              video.addEventListener('error', (e) => {
                console.error('Error loading video ' + i + ':', e);
                window.mergingError = 'Error loading video ' + i;
                window.mergingComplete = true;
              });
            }
          </script>
        </body>
      </html>
    `);

    // Wait for merging to complete
    await page.waitForFunction('window.mergingComplete === true', { timeout: 60000 });

    // Check for errors
    const error = await page.evaluate(() => window.mergingError);
    if (error) {
      throw new Error(error);
    }

    // Get the merged video data
    const mergedVideo = await page.evaluate(() => window.mergedVideo);
    if (!mergedVideo) {
      throw new Error('Failed to get merged video data');
    }

    return res.status(200).json({
      video: mergedVideo
    });
  } catch (error) {
    console.error('Error merging videos:', error);
    return res.status(500).json({ error: 'Failed to merge videos' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
