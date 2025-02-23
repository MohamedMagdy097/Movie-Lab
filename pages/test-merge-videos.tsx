'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function TestMergeVideos() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrls, setVideoUrls] = useState<string[]>([
    'https://v3.fal.media/files/panda/a4KnMLJu658u1nmKnfxBc_output.mp4',
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queue = useRef<ArrayBuffer[]>([]);
  const isAppending = useRef<boolean>(false);

  const handleAddVideo = () => setVideoUrls([...videoUrls, '']);
  const handleRemoveVideo = (index: number) => setVideoUrls(videoUrls.filter((_, i) => i !== index));
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const initializeMediaSource = () => {
    console.log('Initializing MediaSource...');
    if (!videoRef.current) {
      console.error('Video element not found');
      return;
    }

    try {
      mediaSourceRef.current = new MediaSource();
      const mediaUrl = URL.createObjectURL(mediaSourceRef.current);
      console.log('Created MediaSource URL:', mediaUrl);
      videoRef.current.src = mediaUrl;

      mediaSourceRef.current.addEventListener('sourceopen', async () => {
        console.log('MediaSource opened');
        if (!mediaSourceRef.current) return;

        try {
          // Try different codec strings
          const codecStrings = [
            'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
            'video/mp4; codecs="avc1.64001E,mp4a.40.2"',
            'video/mp4;'
          ];

          let supported = false;
          let mimeType = '';

          for (const codec of codecStrings) {
            if (MediaSource.isTypeSupported(codec)) {
              supported = true;
              mimeType = codec;
              console.log('Found supported codec:', codec);
              break;
            }
          }

          if (!supported) {
            throw new Error('No supported video format found');
          }

          sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(mimeType);
          console.log('SourceBuffer created');
          sourceBufferRef.current.mode = 'sequence';

          sourceBufferRef.current.addEventListener('updateend', () => {
            console.log('SourceBuffer update ended');
            isAppending.current = false;
            appendNextBuffer();
          });

          sourceBufferRef.current.addEventListener('error', (e) => {
            console.error('SourceBuffer error:', e);
          });

          await loadAllVideos();
        } catch (err) {
          console.error('Error initializing SourceBuffer:', err);
          switchToSimplePlayback(videoUrls);
        }
      });

      mediaSourceRef.current.addEventListener('sourceended', () => {
        console.log('MediaSource ended');
      });

      mediaSourceRef.current.addEventListener('sourceclose', () => {
        console.log('MediaSource closed');
      });

    } catch (err) {
      console.error('Error creating MediaSource:', err);
      switchToSimplePlayback(videoUrls);
    }
  };

  const loadAllVideos = async () => {
    console.log('Starting to load all videos...');
    queue.current = [];

    for (const url of videoUrls) {
      if (!url.trim()) continue;
      
      try {
        console.log(`Fetching video: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`Video content type: ${contentType}`);

        const videoData = await response.arrayBuffer();
        console.log(`Received video data of size: ${videoData.byteLength} bytes`);
        
        queue.current.push(videoData);
        console.log(`Successfully queued video. Total videos in queue: ${queue.current.length}`);

        // Start appending if we haven't started yet
        if (!isAppending.current) {
          console.log('Starting to append buffers...');
          appendNextBuffer();
        }
      } catch (err) {
        console.error(`Error loading video ${url}:`, err);
        setError(`Failed to load video: ${url}`);
      }
    }

    if (queue.current.length === 0) {
      console.error('No videos were successfully loaded');
      setError('No videos were successfully loaded');
      return;
    }

    console.log(`Finished loading all videos. Total in queue: ${queue.current.length}`);
  };

  const appendNextBuffer = () => {
    console.log('Attempting to append next buffer...');
    
    if (!sourceBufferRef.current) {
      console.error('No SourceBuffer available');
      return;
    }

    if (queue.current.length === 0) {
      console.log('No more buffers to append. Ending stream.');
      try {
        if (mediaSourceRef.current?.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
          console.log('Successfully ended media stream');
        }
      } catch (err) {
        console.error('Error ending media stream:', err);
      }
      return;
    }

    if (sourceBufferRef.current.updating) {
      console.log('SourceBuffer is still updating, waiting...');
      return;
    }

    try {
      isAppending.current = true;
      const nextBuffer = queue.current.shift();
      
      if (nextBuffer) {
        console.log(`Appending buffer of size: ${nextBuffer.byteLength} bytes`);
        sourceBufferRef.current.appendBuffer(nextBuffer);
        
        // Start playback if paused
        if (videoRef.current?.paused) {
          console.log('Starting video playback...');
          videoRef.current.play()
            .then(() => console.log('Playback started successfully'))
            .catch(err => {
              console.error('Error starting playback:', err);
              setError('Failed to start video playback');
            });
        }
      }
    } catch (err) {
      console.error('Error appending buffer:', err);
      setError('Error appending video data');
      switchToSimplePlayback(videoUrls);
    }
  };

  const switchToSimplePlayback = (urls: string[]) => {
    console.log('Switching to simple playback mode');
    setError('Failed to use MediaSource, falling back to normal playback.');
    if (videoRef.current) {
      videoRef.current.src = urls[0];
      videoRef.current.load();
      videoRef.current.play().catch((err) => console.error('Error playing video:', err));
    }
  };

  const handleMergeVideos = () => {
    if (videoUrls.length === 0) {
      setError('Please add at least one valid video URL');
      return;
    }

    setLoading(true);
    setError(null);
    setIsPlaying(true);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Video Merge Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Video URLs</h3>
              <Button onClick={handleAddVideo} variant="outline" size="sm">
                Add Video URL
              </Button>
            </div>

            {videoUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="Enter video URL"
                  className="flex-1"
                />
                <Button
                  onClick={() => handleRemoveVideo(index)}
                  variant="destructive"
                  size="sm"
                  disabled={videoUrls.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={handleMergeVideos} disabled={loading} className="w-full">
            {loading ? 'Preparing Videos...' : 'Play Videos'}
          </Button>

          {error && <div className="text-red-500 mt-2">Error: {error}</div>}

          {isPlaying && (
            <div className="space-y-2 mt-4">
              <h3 className="text-lg font-medium">Merged Video Playback</h3>
              <video ref={videoRef} controls className="w-full rounded-lg" playsInline />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
