'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function VideoDashboard() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [syncedVideoUrl, setSyncedVideoUrl] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  type ValidDuration = "5" | "10";
  const [duration, setDuration] = useState<ValidDuration>("5");
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [audioPrompt, setAudioPrompt] = useState('');

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Compression options
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };

      try {
        const compressedFile = await imageCompression(file, options);
        setImage(compressedFile);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreview(e.target.result as string);
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Error compressing image. Please try again with a different image.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !prompt) return;

    setLoading(true);
    setSyncedVideoUrl('');
    try {
      // Step 1: Generate audio first
      setCurrentStep('Generating audio from text...');
      // We already have the base64 image from imagePreview
      const base64Image = imagePreview.split(',')[1]; // Remove the data:image/jpeg;base64, prefix
      
      const audioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: prompt,
          base64Image // Send the base64 image data
        }),
      });

      if (!audioResponse.ok) {
        throw new Error('Failed to generate audio');
      }

      const { audio } = await audioResponse.json();
      const audioBase64 = `data:audio/mp3;base64,${audio}`;
      setAudioUrl(audioBase64);

      // Step 2: Generate video
      setCurrentStep('Generating video from image...');
      const formData = new FormData();
      formData.append('image', image);
      formData.append('prompt', prompt);
      formData.append('duration', duration);
      formData.append('aspectRatio', aspectRatio);

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate video');
      }

      const data = await response.json();
      setVideoUrl(data.video.url);

      // Step 3: Sync lip movement
      setCurrentStep('Syncing lip movement with audio...');
      const syncResponse = await fetch('/api/sync-lip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: data.video.url,
          audioUrl: audioBase64
        }),
      });

      if (!syncResponse.ok) {
        throw new Error('Failed to sync lip movement');
      }

      const syncData = await syncResponse.json();
      setSyncedVideoUrl(syncData.syncedVideo.url);
      setCurrentStep('All done!');
    } catch (error) {
      console.error('Error generating video:', error);
      alert('Failed to generate video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Image to Video Converter</CardTitle>
          <CardDescription>
            Transform your images into captivating videos using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload Image</label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg object-contain"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe how you want the video to look..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <Select value={duration} onValueChange={(value) => setDuration(value as ValidDuration)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Aspect Ratio</label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="1:1">1:1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!image || !prompt || loading}
            >
              {loading ? currentStep : 'Generate Video'}
            </Button>

            {syncedVideoUrl ? (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Final Video with Lip Sync</h3>
                <video
                  controls
                  className="w-full rounded-lg"
                  src={syncedVideoUrl}
                />
              </div>
            ) : videoUrl && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Generated Video (Processing...)</h3>
                <video
                  controls
                  className="w-full rounded-lg"
                  src={videoUrl}
                />
              </div>
            )}
            {audioUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Generated Audio</h3>
                <audio controls className="w-full" src={audioUrl} />
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
