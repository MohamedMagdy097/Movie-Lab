'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function TestLipSync() {
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncedVideo, setSyncedVideo] = useState('');

  const handleTest = async () => {
    try {
      setLoading(true);
      setError('');
      setSyncedVideo('');

      const response = await fetch('/api/sync-lip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          audioUrl
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync lip movement');
      }

      const data = await response.json();
      setSyncedVideo(data.syncedVideo);
    } catch (err) {
      console.error('Test error:', err);
      setError( 'Failed to test lip sync');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Test Lip Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Video URL</label>
            <Input
              placeholder="Enter video URL..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Audio URL</label>
            <Input
              placeholder="Enter audio URL or base64..."
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={loading || !videoUrl || !audioUrl}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Lip Sync'
            )}
          </Button>

          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}

          {syncedVideo && (
            <div className="mt-4 space-y-2">
              <h3 className="text-lg font-medium">Result Video</h3>
              <video
                controls
                className="w-full rounded-lg"
                src={syncedVideo}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
