'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function VideoDashboard() {
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [subtitles, setSubtitles] = useState<string[]>(['']);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  interface GeneratedVideo {
    url: string;
    description: string;
    subtitles: string;
  }

  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [syncedVideoUrls, setSyncedVideoUrls] = useState<string[]>([]);
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

  const processScene = async (sceneIndex: number, inputImage: string, subtitle: string, prompt: string) => {
    try {
      // Generate audio for this scene
      const audioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: subtitle,
          base64Image: inputImage.split(',')[1] // Remove data:image/jpeg;base64, prefix
        }),
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to generate audio for scene ${sceneIndex + 1}`);
      }

      const { audio } = await audioResponse.json();
      const audioBase64 = `data:audio/mp3;base64,${audio}`;

      // Generate video for this scene
      const formData = new FormData();
      const imageBlob = await fetch(inputImage).then(r => r.blob());
      const sceneImage = new File([imageBlob], 'scene.jpg', { type: 'image/jpeg' });
      
      formData.append('image', sceneImage);
      formData.append('prompts', JSON.stringify([prompt]));
      formData.append('subtitles', JSON.stringify([subtitle]));
      formData.append('duration', duration);
      formData.append('aspectRatio', aspectRatio);

      const videoResponse = await fetch('/api/generate-video', {
        method: 'POST',
        body: formData,
      });

      if (!videoResponse.ok) {
        const error = await videoResponse.json();
        throw new Error(error.message || `Failed to generate video for scene ${sceneIndex + 1}`);
      }

      const videoData = await videoResponse.json();
      if (!videoData.videos?.[0]?.url) {
        throw new Error(`No valid video URL for scene ${sceneIndex + 1}`);
      }

      // Sync lip movement
      const syncResponse = await fetch('/api/sync-lip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: videoData.videos[0].url,
          audioUrl: audioBase64
        }),
      });

      if (!syncResponse.ok) {
        throw new Error(`Failed to sync lip movement for scene ${sceneIndex + 1}`);
      }

      const { url: syncedUrl } = await syncResponse.json();
      return syncedUrl;
    } catch (error) {
      console.error(`Error processing scene ${sceneIndex + 1}:`, error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || prompts.some(p => !p)) return;

    setLoading(true);
    setSyncedVideoUrls([]);
    const finalVideos = [];
    try {
      let currentImage = imagePreview;
      const generatedVideos = [];
      const syncedVideos = [];
      let currentStep = 0;
      const totalSteps = prompts.length * 3 + 1; // Audio + (Video + Frame + Sync) per scene

      const updateProgress = (step: string) => {
        currentStep++;
        setCurrentStep(`${step} (${Math.round((currentStep / totalSteps) * 100)}%)`);
      };

      // First, generate TTS for all scenes
      updateProgress('Generating audio for all scenes');
      const allText = subtitles.join('. '); // Add pause between scenes
      const audioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: allText,
          base64Image: imagePreview.split(',')[1]
        })
      });

      if (!audioResponse.ok) {
        throw new Error('Failed to generate audio');
      }

      const { audio: audioBase64 } = await audioResponse.json();
      const generatedAudioUrl = `data:audio/mp3;base64,${audioBase64}`;
      setAudioUrl(generatedAudioUrl);
      
      // Then generate all videos sequentially
      for (let i = 0; i < prompts.length; i++) {
        // Generate video for current scene
        updateProgress(`Generating video for scene ${i + 1}/${prompts.length}`);
        
        const formData = new FormData();
        formData.append('prompts', JSON.stringify([prompts[i]]));
        formData.append('subtitles', JSON.stringify([subtitles[i]]));
        formData.append('duration', duration);
        formData.append('aspectRatio', aspectRatio);
        
        // Use the current image (either initial image or last frame)
        const base64Response = await fetch(currentImage);
        const blob = await base64Response.blob();
        formData.append('image', blob, 'image.png');

        const videoResponse = await fetch('/api/generate-video', {
          method: 'POST',
          body: formData
        });

        if (!videoResponse.ok) {
          throw new Error(`Failed to generate video for scene ${i + 1}`);
        }

        const videoData = await videoResponse.json();
        if (!videoData.videos?.[0]?.url) {
          throw new Error(`No valid video URL for scene ${i + 1}`);
        }

        generatedVideos.push({
          url: videoData.videos[0].url,
          description: `Scene ${i + 1}: ${prompts[i].substring(0, 50)}...`,
          subtitles: subtitles[i] || ''
        });

        // Extract the last frame for the next scene
        if (i < prompts.length - 1) {
          updateProgress(`Preparing transition to scene ${i + 2}`);
          const frameResponse = await fetch('/api/extract-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: videoData.videos[0].url }),
          });
          
          if (!frameResponse.ok) {
            throw new Error(`Failed to extract frame from scene ${i + 1}`);
          }
          
          const { frame } = await frameResponse.json();
          currentImage = frame;
        }
      }

      // Update UI with generated videos
      setVideos(generatedVideos);

      // Now sync lip movement for each video
      for (let i = 0; i < generatedVideos.length; i++) {
        updateProgress(`Syncing lip movement for scene ${i + 1}/${generatedVideos.length}`);
        
        const syncResponse = await fetch('/api/sync-lip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: generatedVideos[i].url,
            audioUrl: generatedAudioUrl
          }),
        });

        if (!syncResponse.ok) {
          throw new Error(`Failed to sync lip movement for scene ${i + 1}`);
        }

        const data = await syncResponse.json();
        // Handle both formats: direct URL or video object with url property
        const videoUrl = data.video?.url || data.syncedVideo?.url || data.syncedVideo;
        if (!videoUrl) {
          console.error('Invalid sync response:', data);
          throw new Error(`No valid video URL in sync response for scene ${i + 1}`);
        }
        syncedVideos.push(videoUrl);
      }

      // Set synced videos
      setSyncedVideoUrls(syncedVideos);

      // If we have multiple scenes, merge them
      if (syncedVideos.length > 1) {
        updateProgress('Creating final video with all scenes');
        const mergeResponse = await fetch('/api/merge-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrls: syncedVideos }),
        });

        if (!mergeResponse.ok) {
          throw new Error('Failed to merge videos');
        }

        const { video: finalVideo } = await mergeResponse.json();
        
        // Add the final merged video to the list
        setSyncedVideoUrls([...syncedVideos, finalVideo]);
      }

      setCurrentStep('All done! Final video is ready!');
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error in video processing:', err);
      alert(err.message || 'Failed to process video. Please try again.');
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

            <div className="space-y-4">
              {Array.from({ length: parseInt(duration) / 5 }).map((_, index) => (
                <div key={index} className="space-y-4 border rounded-lg p-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-lg font-medium">Cut Scene {index + 1} (5 seconds)</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              setIsGenerating(true);
                              const response = await fetch('/api/generate-scene-suggestions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sceneNumber: index + 1,
                                  totalScenes: parseInt(duration) / 5,
                                  base64Image: imagePreview.split(',')[1],
                                  type: 'both'
                                })
                              });

                              if (!response.ok) throw new Error('Failed to generate suggestions');
                              
                              const data = await response.json();
                              const newPrompts = [...prompts];
                              const newSubtitles = [...subtitles];
                              newPrompts[index] = data.sceneDescription;
                              newSubtitles[index] = data.subtitles;
                              setPrompts(newPrompts);
                              setSubtitles(newSubtitles);
                            } catch (error) {
                              console.error('Error getting suggestions:', error);
                              alert('Failed to get scene suggestions');
                            } finally {
                              setIsGenerating(false);
                            }
                          }}
                          disabled={isGenerating || !imagePreview}
                        >
                          {isGenerating ? 'Generating...' : 'Get All Suggestions'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Scene Description</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            setIsGenerating(true);
                            const response = await fetch('/api/generate-scene-suggestions', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                sceneNumber: index + 1,
                                totalScenes: parseInt(duration) / 5,
                                base64Image: imagePreview.split(',')[1],
                                type: 'description'
                              })
                            });

                            if (!response.ok) throw new Error('Failed to generate description');
                            
                            const data = await response.json();
                            const newPrompts = [...prompts];
                            newPrompts[index] = data.sceneDescription;
                            setPrompts(newPrompts);
                          } catch (error) {
                            console.error('Error getting description:', error);
                            alert('Failed to generate description');
                          } finally {
                            setIsGenerating(false);
                          }
                        }}
                        disabled={isGenerating || !imagePreview}
                      >
                        🔄 Regenerate
                      </Button>
                    </div>
                    <Textarea
                      placeholder={`Describe how you want cut scene ${index + 1} to look...`}
                      value={prompts[index] || ''}
                      onChange={(e) => {
                        const newPrompts = [...prompts];
                        newPrompts[index] = e.target.value;
                        setPrompts(newPrompts);
                      }}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Subtitles</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            setIsGenerating(true);
                            const response = await fetch('/api/generate-scene-suggestions', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                sceneNumber: index + 1,
                                totalScenes: parseInt(duration) / 5,
                                base64Image: imagePreview.split(',')[1],
                                type: 'subtitles'
                              })
                            });

                            if (!response.ok) throw new Error('Failed to generate subtitles');
                            
                            const data = await response.json();
                            const newSubtitles = [...subtitles];
                            newSubtitles[index] = data.subtitles;
                            setSubtitles(newSubtitles);
                          } catch (error) {
                            console.error('Error getting subtitles:', error);
                            alert('Failed to generate subtitles');
                          } finally {
                            setIsGenerating(false);
                          }
                        }}
                        disabled={isGenerating || !imagePreview}
                      >
                        🔄 Regenerate
                      </Button>
                    </div>
                    <Textarea
                      placeholder={`Enter subtitles or dialogue for cut scene ${index + 1}...`}
                      value={subtitles[index] || ''}
                      onChange={(e) => {
                        const newSubtitles = [...subtitles];
                        newSubtitles[index] = e.target.value;
                        setSubtitles(newSubtitles);
                      }}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <Select 
                  value={duration} 
                  onValueChange={(value: ValidDuration) => {
                    setDuration(value);
                    // Update prompts array based on new duration
                    const numScenes = parseInt(value) / 5;
                    setPrompts(prev => {
                      const newPrompts = [...prev];
                      while (newPrompts.length < numScenes) newPrompts.push('');
                      while (newPrompts.length > numScenes) newPrompts.pop();
                      return newPrompts;
                    });
                    setSubtitles(prev => {
                      const newSubtitles = [...prev];
                      while (newSubtitles.length < numScenes) newSubtitles.push('');
                      while (newSubtitles.length > numScenes) newSubtitles.pop();
                      return newSubtitles;
                    });
                  }}>

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

            <div className="flex space-x-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={!image || prompts.some(p => !p) || loading}
              >
                {loading ? currentStep : 'Generate Video'}
              </Button>

              {videos.length > 0 && audioUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setCurrentStep('Testing lip sync...');

                      const syncResponse = await fetch('/api/sync-lip', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          videoUrl: videos[0].url,
                          audioUrl: audioUrl
                        }),
                      });

                      if (!syncResponse.ok) {
                        const error = await syncResponse.json();
                        throw new Error(error.message || 'Failed to sync lip movement');
                      }

                      const { syncedVideo } = await syncResponse.json();
                      setSyncedVideoUrls([syncedVideo]);
                      setCurrentStep('Lip sync test completed!');
                    } catch (error) {
                      console.error('Test error:', error);
                      alert(error.message || 'Failed to test lip sync');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Lip Sync'}
                </Button>
              )}
            </div>

            {syncedVideoUrls.length > 0 ? (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium mb-2">Final Videos with Lip Sync</h3>
                {syncedVideoUrls.map((url, index) => (
                  <div key={url} className="space-y-2">
                    <h4 className="text-md font-medium">{videos[index]?.description || `Cut Scene ${index + 1} (5 seconds)`}</h4>
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={url}
                    />
                  </div>
                ))}
              </div>
            ) : videos.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium mb-2">Generated Videos (Processing...)</h3>
                {videos.map((video, index) => (
                  <div key={video.url} className="space-y-2">
                    <h4 className="text-md font-medium">{video.description}</h4>
                    <video
                      controls
                      className="w-full rounded-lg"
                      src={video.url}
                    />
                  </div>
                ))}
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
