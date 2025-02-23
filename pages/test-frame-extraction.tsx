'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestFrameExtraction() {
  const [loading, setLoading] = useState(false);
  const [extractedFrame, setExtractedFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testVideo = {
    url: 'https://v3.fal.media/files/panda/a4KnMLJu658u1nmKnfxBc_output.mp4',
    description: 'Cut Scene 1 (5 seconds):',
    subtitles: 'Welcome to our skincare studio, where beauty meets innovation every day!'
  };

  const handleExtractFrame = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/extract-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl: testVideo.url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract frame');
      }

      const data = await response.json();
      setExtractedFrame(data.frame);
    } catch (err) {
      console.error('Error extracting frame:', err);
      setError(err instanceof Error ? err.message : 'Failed to extract frame');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Frame Extraction Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Original Video</h3>
            <video
              controls
              className="w-full rounded-lg"
              src={testVideo.url}
            />
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleExtractFrame}
              disabled={loading}
            >
              {loading ? 'Extracting Frame...' : 'Extract Last Frame'}
            </Button>

            {error && (
              <div className="text-red-500">
                Error: {error}
              </div>
            )}

            {extractedFrame && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Extracted Frame</h3>
                <img
                  src={extractedFrame}
                  alt="Extracted frame"
                  className="w-full rounded-lg"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
